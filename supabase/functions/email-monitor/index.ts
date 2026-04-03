// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Imap from "npm:imap-simple";
import { simpleParser } from "npm:mailparser";
import nodemailer from "npm:nodemailer";

// Configuration from Environment Variables
const IMAP_USER = Deno.env.get("IMAP_USER");
const IMAP_PASSWORD = Deno.env.get("IMAP_PASSWORD");
const IMAP_HOST = Deno.env.get("IMAP_HOST") || "imap.gmail.com";
const IMAP_PORT = 993;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Hack: Suppress Deno/Node polyfill TCP read errors
  // These occur due to a known issue in the compatibility layer when sockets close.
  // We ignore them so the function doesn't crash as "Unhealthy".
  // @ts-ignore
  if (typeof process !== 'undefined' && process.on) {
      // @ts-ignore
      process.on('uncaughtException', (err: any) => {
          if (err && err.message && (
              err.message.includes('Symbol(Deno.internal.rid)') || 
              err.message.includes('Connection ended unexpectedly')
          )) {
              console.warn("Suppressing known Deno/Node polyfill error:", err.message);
              return;
          }
          console.error("Uncaught exception:", err);
      });
       // @ts-ignore
      process.on('unhandledRejection', (reason: any) => {
           if (reason && reason.message && reason.message.includes('Symbol(Deno.internal.rid)')) {
              return;
           }
          console.error("Unhandled rejection:", reason);
      });
  }

  try {
    if (!IMAP_USER || !IMAP_PASSWORD) {
      throw new Error("Missing IMAP_USER or IMAP_PASSWORD env vars");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Setup Nodemailer (SMTP) - Assuming Gmail or similar structure to IMAP host
    // If IMAP is imap.gmail.com, SMTP is usually smtp.gmail.com
    const smtpHost = IMAP_HOST.replace("imap.", "smtp.");
    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: 465,
        secure: true,
        auth: {
            user: IMAP_USER,
            pass: IMAP_PASSWORD
        }
    });

    const config = {
      imap: {
        user: IMAP_USER,
        password: IMAP_PASSWORD,
        host: IMAP_HOST,
        port: IMAP_PORT,
        tls: true,
        authTimeout: 30000, // Increased to 30s
        connTimeout: 30000, // Explicit 30s connection timeout
        tlsOptions: { rejectUnauthorized: false }, 
      },
    };

    console.log(`Connecting to IMAP ${IMAP_HOST}...`);
    console.log(`Connecting to IMAP ${IMAP_HOST}...`);
    const connection = await Imap.connect(config);

    // Suppress "Connection ended unexpectedly" on the connection instance
    connection.on('error', (err: any) => {
        if (err && err.message === 'Connection ended unexpectedly') {
            console.warn("Suppressing IMAP connection error (expected behavior on close)");
            return;
        }
        console.error("IMAP Connection Error:", err);
    });

    // Also suppress on the underlying node-imap object if available
    // @ts-ignore
    if (connection.imap) {
        // @ts-ignore
        connection.imap.on('error', (err: any) => {
             if (err && err.message === 'Connection ended unexpectedly') {
                return;
            }
            console.error("Underlying IMAP Error:", err);
        });
    }

    await connection.openBox("INBOX");

    const searchCriteria = ["UNSEEN"];
    const fetchOptions = {
      bodies: ["HEADER", "TEXT", ""],
      markSeen: false, 
      struct: true,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`Found ${messages.length} unseen messages.`);

    if (messages.length === 0) {
      connection.end();
      return new Response(JSON.stringify({ message: "No new emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processedCount = 0;

    // Helper to notify
    const sendNotification = async (docStr: string, certName: string) => {
        try {
            // Find Owner Name
            // Try cleaning doc
            const cleanDoc = docStr.replace(/[^0-9]/g, "");
            
            // Try query: match valid formatted or clean
            let { data: owner } = await supabase
                .from('proprietarios')
                .select('nome_completo')
                .eq('cpf_cnpj', cleanDoc)
                .single();
            
            // If not found, try formatted if possible (naive) - skipped for now, relying on clean
            // If clean stored in DB? DB usually has clean or formatted. 
            // Let's try flexible search if single failed? No, keep simple.

            const clientName = owner?.nome_completo || "Cliente Não Identificado";
            const subject = `[Certidão Pronta] ${clientName} - ${certName}`;
            const text = `
Olá,

A certidão "${certName}" referente ao documento ${docStr} (Cliente: ${clientName}) foi baixada e salva no sistema com sucesso.

Você pode visualizá-la no painel de certidões.

Sistema de Automação
            `;

            console.log(`Sending notification for ${clientName}...`);
            await transporter.sendMail({
                from: `"Certidões Bot" <${IMAP_USER}>`,
                to: IMAP_USER, // Sending to self/admin
                subject: subject,
                text: text
            });
            console.log("Email Notification sent.");

            // Insert into 'notificacoes' table for Sidebar Bell
            const bucketUrl = `${SUPABASE_URL}/storage/v1/object/public/certidoes_juridicas/${docStr}`; // folder link or specific file? 
            // Better to link to the specific file or just the folder. 
             // We passed 'certName' (filename) to this function. 
            // But 'docStr' is just the numbers. The path was constructed as `${docStr}/${filename}` in the caller.
            // Let's passed the full path or reconstructed it.
            // The file path is `certName` argument in this context? 
            // Wait, in caller: sendNotification(docClean, attachment.filename);
            // So certName is filename.
            
            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/certidoes_juridicas/${docStr}/${certName}`;

            await supabase.from('notificacoes').insert({
                titulo: `Certidão Chegou: ${clientName}`,
                mensagem: `Documento ${certName} baixado com sucesso via email.`,
                link_url: publicUrl,
                tipo: 'certidao',
                lida: false
            });
            console.log("System Notification inserted.");
        } catch (e) {
            console.error("Failed to send notification:", e);
        }
    };

    for (const message of messages) {
      // Replaced lodash _.find with native find
      const all = message.parts.find((p: any) => p.which === "");
      const id = message.attributes.uid;
      
      // Fetch full body to parse
      const rawData = await connection.getPartData(message, all);
      const parsed = await simpleParser(rawData);

      const subject = parsed.subject || "";
      const from = parsed.from?.text || "";
      const bodyText = parsed.text || "";
      const bodyHtml = parsed.html || ""; 

      console.log(`Processing: ${subject} from ${from}`);

      // Check relevance
      const relevantKeywords = [
        "certidão", "certidao", "tjsp", "trf", "trt", "tst", "cjf",
        "receita", "fazenda", "sefaz", "justiça federal", "justica federal",
        "conselho", "tribunal", "protesto", "cenprot"
      ];
      const isRelevant = relevantKeywords.some(kw => 
        subject.toLowerCase().includes(kw) || from.toLowerCase().includes(kw)
      );

      if (!isRelevant) {
        console.log("Skipping: Not relevant.");
        continue;
      }

      // SAFETY LIMIT: Process max 2 emails per run to prevent Edge Function Timeout (usually 10s).
      // Since Cron runs every 10 min, we can handle backlog (12/hour) easily.
      if (processedCount >= 2) {
          console.log("Batch limit reached (2 emails). Finishing gracefully to avoid timeout.");
          break;
      }

      let hasAttachment = false;

      // --- Helper to extract CPF/CNPJ ---
      const getDestFolder = (filename: string, textContent: string) => {
        const combined = `${filename} ${subject} ${textContent}`;
        const clean = (s: string) => s.replace(/[^0-9]/g, "");

        // Prioridade: CNPJ Formated -> CPF Formated -> Raw Numbers
        const cnpjMatch = combined.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
        if (cnpjMatch) return clean(cnpjMatch[0]);

        const cpfMatch = combined.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
        if (cpfMatch) return clean(cpfMatch[0]);
        
        // "CPF/CNPJ consultado: XXX"
        const consultadoMatch = combined.match(/(?:CPF|CNPJ)[^:]*:\s*([\d\.\-/]+)/i);
        if (consultadoMatch) return clean(consultadoMatch[1]);

        const rawMatch = combined.match(/\b\d{11,14}\b/);
        if (rawMatch) return clean(rawMatch[0]);

        return "Inbox";
      };

      // --- Process Attachments ---
      if (parsed.attachments && parsed.attachments.length > 0) {
        for (const attachment of parsed.attachments) {
            if (attachment.filename && attachment.filename.toLowerCase().endsWith(".pdf")) {
                hasAttachment = true;
                const docClean = getDestFolder(attachment.filename, bodyText);
                const folder = docClean;
                const filePath = `${folder}/${attachment.filename}`;

                console.log(`Uploading ${filePath}...`);
                
                const { error } = await supabase.storage
                    .from("certidoes_juridicas")
                    .upload(filePath, attachment.content, {
                        contentType: "application/pdf",
                        upsert: true
                    });

                if (error) console.error(`Error uploading ${filePath}:`, error);
                else {
                    console.log(`Uploaded ${filePath} successfully.`);
                    // Send Notification
                    await sendNotification(docClean, attachment.filename);
                }
            }
        }
      }

      // --- Handle TJSP Links (No attachment) ---
      if (!hasAttachment && (from.toLowerCase().includes("tjsp") || subject.toLowerCase().includes("tjsp"))) {
        console.log("Checking for TJSP links...");
        const combinedBody = bodyHtml + " " + bodyText;
        const linkMatch = combinedBody.match(/(https:\/\/esaj\.tjsp\.jus\.br\/sco\/realizarDownload\.do\?[^\s"\'<>]+)/);

        if (linkMatch) {
            let downloadUrl = linkMatch[1].replace(/&amp;/g, "&");
            
            const cpfMatch = downloadUrl.match(/nuCpf=([\d\.\-]+)/);
            const docStr = cpfMatch ? cpfMatch[1].replace(/[^0-9]/g, "") : "Unknown";
            const filename = `TJSP_Certidao_${docStr}.pdf`;
            const filePath = `${docStr}/${filename}`;

            try {
                const docRes = await fetch(downloadUrl);
                const blob = await docRes.blob();
                if (blob.type === 'application/pdf' || (await blob.text()).startsWith('%PDF')) {
                     const { error } = await supabase.storage
                        .from("certidoes_juridicas")
                        .upload(filePath, blob, {
                            contentType: "application/pdf",
                            upsert: true
                        });
                    if (error) console.error(`TJSP Upload Error:`, error);
                    else {
                        console.log(`TJSP Upload Success: ${filePath}`);
                        hasAttachment = true;
                        // Send Notification
                        await sendNotification(docStr, "TJSP 1º/2º Grau");
                    }
                } 
            } catch (err) {
                console.error("Error fetching TJSP link:", err);
            }
        }
      }

      if (hasAttachment) {
          await connection.addFlags(id, "\\Seen");
          processedCount++;
      }
    }

    // Deno/Node polyfill issue mitigation:
    // Solução Definitiva: Garantir fechamento real do socket antes do retorno.
    
    const closeConnection = () => new Promise((resolve) => {
        if (!connection) return resolve(true);
        
        // Timeout de segurança para o fechamento não travar a função
        const timer = setTimeout(() => {
            console.warn("Forçando encerramento por timeout de fechamento");
            resolve(true);
        }, 2000);

        // Ouvir eventos da conexão interna (imap-simple expõe .imap como a instância node-imap)
        // Precisamos checar onde attachar os listeners. O objeto 'connection' do imap-simple 
        // não emite 'close' diretamente, mas connection.imap sim.
        
        const socketSource = connection.imap || connection;

        socketSource.on('end', () => {
            clearTimeout(timer);
            console.log("Evento 'end' recebido: Conexão finalizada.");
            resolve(true);
        });

        socketSource.on('close', () => {
            clearTimeout(timer);
            console.log("Evento 'close' recebido.");
            resolve(true);
        });
        
        // Error listener para evitar crash no fechamento
        socketSource.on('error', (err: any) => {
             console.warn("Erro no fechamento (ignorado):", err.message);
             // Não resolvemos imediatamente, deixamos o 'close' ou timeout agir, 
             // ou se for fatal, o timeout resolve.
        });

        try {
            connection.end();
        } catch (e: any) {
            console.error("Erro ao chamar end():", e.message);
            resolve(true);
        }
    });

    // 2. Aguardar o fechamento completo antes de responder
    await closeConnection();
    
    return new Response(JSON.stringify({ success: true, processed: processedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Polyfill for lodash find (simple version if needed, or import lodash)
// Using simplified logic above directly with 'message' object from imap-simple which handles structure.
// Note: imap-simple returns objects differently. check logic below.

 
