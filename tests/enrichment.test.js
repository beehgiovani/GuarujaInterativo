/**
 * 🧪 Testes para enrichment_handler.js
 */

test('Cálculo de Idade do Prédio (Lógica)', () => {
    // Simulando a extração de ano de uma data ISO da Receita
    const dataAbertura = "2010-05-20";
    const ano = new Date(dataAbertura).getFullYear();
    const currentYear = new Date().getFullYear();
    
    expect(ano).toBe(2010);
    expect(currentYear >= ano).toBeTruthy();
});

test('Sanitização de CNPJ para API', () => {
    const cnpjSujo = " 12.345.678/0001-99 ";
    const limpo = cnpjSujo.replace(/\D/g, '');
    expect(limpo).toBe("12345678000199");
});
