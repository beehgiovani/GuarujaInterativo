/**
 * 🧪 Testes para utils.js
 */

// Mock de Globais do Navegador
global.window = {
    Monetization: { userRole: 'user' },
    location: { hostname: 'localhost' },
    document: { getElementById: () => ({ classList: { add: () => {}, remove: () => {} }, querySelector: () => ({}) }) }
};
global.document = global.window.document;
global.navigator = { onLine: true };

// Carregar funções (Simulando o ambiente onde elas são atribuídas ao window)
// Como o utils.js usa window.validateCPF, precisamos injetar o mock
const fs = require('fs');
const path = require('path');
const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
eval(utilsCode);

test('Validação de CPF', () => {
    // CPF válido real
    expect(window.validateCPF('12345678909')).toBeTruthy(); 
    // CPF inválido
    expect(window.validateCPF('12345678900')).toBeFalsy();
});

test('Máscara de Nome (Reserva)', () => {
    const nome = "BRUNO GIOVANI";
    const mascarado = window.maskName(nome, false);
    expect(mascarado.includes('***')).toBeTruthy();
    expect(mascarado.startsWith('BR')).toBeTruthy();
});

test('Formatação de Documento Mascarado', () => {
    const cpf = "12345678901";
    const formatado = window.formatDocument(cpf, false);
    expect(formatado).toBe("123.***.***-01");
});

test('Cálculo de Distância UTM (Básico)', () => {
    // Apenas garante que a função não quebra
    const lat1 = -23.99, lon1 = -46.26;
    const lat2 = -23.99, lon2 = -46.27;
    const dist = window.getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2);
    expect(dist > 0).toBeTruthy();
});
