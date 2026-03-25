require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const imap = require('imap-simple');
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');

// --- Configuration ---
const IMAP_USER = process.env.IMAP_USER;
const IMAP_PASSWORD = process.env.IMAP_PASSWORD;
const IMAP_HOST = process.env.IMAP_HOST || 'imap.gmail.com';
const IMAP_PORT = 993;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!IMAP_USER || !IMAP_PASSWORD || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing required environment variables. Check .env file.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- SMTP Transport for Notifications ---
const smtpHost = IMAP_HOST.replace("imap.", "smtp.");
const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: 465,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASSWORD }
});

const config = {
    imap: {
        user: IMAP_USER,
        password: IMAP_PASSWORD,
        host: IMAP_HOST,
        port: IMAP_PORT,
        tls: true,
        authTimeout: 10000,
        tlsOptions: { rejectUnauthorized: false },
    }
};

let connection;

async function sendNotification(docStr, certName) {
    try {
        // Clean docs
        const cleanDoc = docStr.replace(/[^0-9]/g, "");

        // Find Owner
        let { data: owner } = await supabase
            .from('proprietarios')
            .select('nome_completo')
            .eq('cpf_cnpj', cleanDoc)
            .single();

        const clientName = owner?.nome_completo || "Cliente NãoIdentificado";
        const subject = `[Certidão Pronta] ${clientName} - ${certName}`;

        // Email Body
        const text = `
Olá,

A certidão "${certName}" referente ao documento ${docStr} (Cliente: ${clientName}) foi baixada e salva no sistema com sucesso.

Você pode visualizá-la no painel de certidões.

Sistema de Automação
        `;

        await transporter.sendMail({
            from: `"Certidões Bot" <${IMAP_USER}>`,
            to: IMAP_USER,
            subject: subject,
            text: text
        });
        console.log(`[Notification] Email sent for ${clientName}`);

        // DB Notification
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/certidoes_juridicas/${docStr}/${certName}`;

        await supabase.from('notificacoes').insert({
            titulo: `Certidão Chegou: ${clientName}`,
            mensagem: `Documento ${certName} baixado com sucesso.`,
            link_url: publicUrl,
            tipo: 'certidao',
            lida: false
        });
        console.log(`[Notification] DB alert created.`);

    } catch (e) {
        console.error('[Notification Error]', e);
    }
}

async function processNewEmails() {
    try {
        const searchCriteria = ['UNSEEN'];
        const fetchOptions = {
            bodies: ['HEADER', 'TEXT', ''],
            markSeen: false,
            struct: true
        };

        const messages = await connection.search(searchCriteria, fetchOptions);
        console.log(`[Check] Found ${messages.length} unseen messages.`);

        if (messages.length === 0) return;

        for (const message of messages) {
            try {
                const all = message.parts.find(p => p.which === "");
                const id = message.attributes.uid;
                const idHeader = "Imap-Id: " + id;

                const rawData = await connection.getPartData(message, all);
                const parsed = await simpleParser(rawData);

                const subject = parsed.subject || "";
                const from = parsed.from?.text || "";
                const bodyText = parsed.text || "";
                const bodyHtml = parsed.html || "";

                console.log(`[Processing] ${subject} from ${from}`);

                // Filter Relevance
                const relevantKeywords = [
                    "certidão", "certidao", "tjsp", "trf", "trt", "tst", "cjf",
                    "receita", "fazenda", "sefaz", "justiça federal", "justica federal",
                    "conselho", "tribunal", "protesto", "cenprot"
                ];

                const isRelevant = relevantKeywords.some(kw =>
                    subject.toLowerCase().includes(kw) || from.toLowerCase().includes(kw)
                );

                if (!isRelevant) {
                    console.log(`[Skip] Not relevant.`);
                    continue;
                }

                let hasAttachment = false;

                // --- Helper: Get Destination Folder (CPF/CNPJ) ---
                const getDestFolder = (filename, textContent) => {
                    const combined = `${filename} ${subject} ${textContent}`;
                    const clean = (s) => s.replace(/[^0-9]/g, "");

                    const cnpjMatch = combined.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
                    if (cnpjMatch) return clean(cnpjMatch[0]);

                    const cpfMatch = combined.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
                    if (cpfMatch) return clean(cpfMatch[0]);

                    const consultadoMatch = combined.match(/(?:CPF|CNPJ)[^:]*:\s*([\d\.\-/]+)/i);
                    if (consultadoMatch) return clean(consultadoMatch[1]);

                    const rawMatch = combined.match(/\b\d{11,14}\b/);
                    if (rawMatch) return clean(rawMatch[0]);

                    return "Inbox_Unsorted";
                };

                // --- Process Attachments ---
                if (parsed.attachments && parsed.attachments.length > 0) {
                    for (const attachment of parsed.attachments) {
                        if (attachment.filename && attachment.filename.toLowerCase().endsWith(".pdf")) {
                            hasAttachment = true;
                            const docClean = getDestFolder(attachment.filename, bodyText);
                            const filePath = `${docClean}/${attachment.filename}`;

                            console.log(`[Upload] Uploading ${filePath}...`);

                            const { error } = await supabase.storage
                                .from("certidoes_juridicas")
                                .upload(filePath, attachment.content, {
                                    contentType: "application/pdf",
                                    upsert: true
                                });

                            if (error) console.error(`[Upload Error] ${filePath}:`, error);
                            else {
                                console.log(`[Upload Success] ${filePath}`);
                                await sendNotification(docClean, attachment.filename);
                            }
                        }
                    }
                }

                // --- Process Links (TJSP) ---
                if (!hasAttachment && (from.toLowerCase().includes("tjsp") || subject.toLowerCase().includes("tjsp"))) {
                    console.log("[Link Check] Checking for TJSP links...");
                    const combinedBody = bodyHtml + " " + bodyText;
                    const linkMatch = combinedBody.match(/(https:\/\/esaj\.tjsp\.jus\.br\/sco\/realizarDownload\.do\?[^\s"\'<>]+)/);

                    if (linkMatch) {
                        let downloadUrl = linkMatch[1].replace(/&amp;/g, "&");
                        const cpfMatch = downloadUrl.match(/nuCpf=([\d\.\-]+)/);
                        const docStr = cpfMatch ? cpfMatch[1].replace(/[^0-9]/g, "") : "Unknown";
                        const filename = `TJSP_Certidao_${docStr}.pdf`;
                        const filePath = `${docStr}/${filename}`;

                        try {
                            // Need fetch with node (v18+ has native fetch, otherwise need node-fetch)
                            // Assuming node 18+ for this environment
                            const docRes = await fetch(downloadUrl);
                            const arrayBuffer = await docRes.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);

                            // Simple check
                            if (buffer.toString('utf8', 0, 4) === '%PDF') {
                                const { error } = await supabase.storage
                                    .from("certidoes_juridicas")
                                    .upload(filePath, buffer, {
                                        contentType: "application/pdf",
                                        upsert: true
                                    });
                                if (error) console.error(`[TJSP Upload Error]`, error);
                                else {
                                    console.log(`[TJSP Upload Success] ${filePath}`);
                                    hasAttachment = true;
                                    await sendNotification(docStr, "TJSP 1º/2º Grau");
                                }
                            }
                        } catch (err) {
                            console.error("[TJSP Link Error]", err);
                        }
                    }
                }

                if (hasAttachment) {
                    await connection.addFlags(id, "\\Seen");
                    console.log(`[Marked Seen] Message ${id}`);
                }

            } catch (err) {
                console.error(`[Message Error]`, err);
            }
        }

    } catch (err) {
        console.error('[Check Error]', err);
    }
}

async function startMonitor() {
    try {
        console.log(`Connecting to IMAP ${IMAP_HOST}...`);
        connection = await imap.connect(config);

        await connection.openBox('INBOX');
        console.log('Connected to INBOX.');

        // 1. Initial Check
        await processNewEmails();

        // 2. Setup IDLE (Real-time listener)
        connection.on('mail', (res) => {
            console.log(`[New Mail] ${res} new message(s) arrived.`);
            processNewEmails();
        });

        // 3. Keep-alive / Reconnect logic
        connection.on('error', (err) => {
            console.error('[Connection Error]', err);
            setTimeout(startMonitor, 5000); // Retry connection
        });

        connection.on('end', () => {
            console.log('[Connection Ended] Reconnecting...');
            setTimeout(startMonitor, 5000);
        });

    } catch (err) {
        console.error('[Fatal Error]', err);
        setTimeout(startMonitor, 10000);
    }
}

// Start the service
startMonitor();
