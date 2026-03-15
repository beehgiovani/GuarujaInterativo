import google.generativeai as genai
import os
from dotenv import load_dotenv

# Carrega variáveis de ambiente (.env) se existir, ou usa a chave fixa do planejamento
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyCMDj4RXAJheWLJX61Vbt6WG_M6eQ_nPrE")

class GeminiAssistant:
    def __init__(self, key=GEMINI_API_KEY):
        genai.configure(api_key=key)
        self.model = genai.GenerativeModel('gemini-2.5-flash-lite')
        
        # System Instructions para a Persona Dual (Foco Interno B2B)
        self.system_instruction = (
            "Você é o 'Farol', o Assistente de Inteligência Estratégica da Omega Imóveis no sistema Guarugeo. "
            "Esta é uma FERRAMENTA INTERNA para uso exclusivo de corretores e gestores. "
            "Sua missão é iluminar o caminho do profissional com precisão técnica e segurança jurídica.\n\n"
            "1. CORRETOR SÊNIOR (Internal): Apoio em avaliações, análise de concorrência e m² no Guarujá.\n"
            "2. ADVOGADO SÊNIOR (Internal): Due diligence, análise de riscos contratuais e redação jurídica.\n\n"
            "REGRAS DE OURO:\n"
            "- Fale de profissional para profissional.\n"
            "- Use termos técnicos apropriados do mercado imobiliário.\n"
            "- Foque em ajudar o corretor a fechar negócios seguros e lucrativos."
        )
            "REGRAS DE OURO:\n"
            "- Sempre forneça respostas profissionais e precisas.\n"
            "- Ao sugerir valores, use o tom de 'Estimativa Baseada em Mercado'.\n"
            "- Se for perguntado sobre um lote ou unidade específica, peça os dados técnicos (Metragem, Bairro, Tipo).\n"
            "- Utilize pesquisa na internet se necessário para validar preços atuais."
        )

    def ask(self, prompt, persona="dual"):
        """
        persona: 'imobiliario', 'juridico' ou 'dual'
        """
        context_prompt = f"{self.system_instruction}\n\nUSUÁRIO SOLICITA AGORA (Contexto: {persona.upper()}):\n{prompt}"
        
        try:
            response = self.model.generate_content(context_prompt)
            return response.text
        except Exception as e:
            return f"Erro na API Gemini: {str(e)}"

if __name__ == "__main__":
    # Teste rápido
    assistant = GeminiAssistant()
    print("--- Teste Persona Imobiliária ---")
    print(assistant.ask("Qual a média de valor de m² para um apartamento de frente para o mar na Praia das Pitangueiras?", persona="imobiliario"))
    
    print("\n--- Teste Persona Jurídica ---")
    print(assistant.ask("Quais são os documentos essenciais que um corretor deve pedir para fechar uma venda com segurança no Guarujá?", persona="juridico"))
