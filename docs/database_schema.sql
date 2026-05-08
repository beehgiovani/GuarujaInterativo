-- GUARUJÁ GEO LAB - ESQUEMA DE BANCO DE DADOS ABSOLUTO (V3.1)
-- Documentação exaustiva de todas as colunas e regras de acesso (RLS).
-- Última atualização: 2026-05-08 (sincronizado com Tooltip v1.20)

--------------------------------------------------------------------------------
-- TABELA: public.lotes
-- RLS: Público (Leitura) | Admin (Escrita)
--------------------------------------------------------------------------------
1.  id (uuid): ID interno do registro.
2.  inscricao (varchar): ID Geográfico ZSSSSLLL (8 dígitos).
3.  municipio (text): Cidade (Guarujá).
4.  zona (text): Zona Fiscal (Cores no mapa).
5.  setor (text): Setor cadastral.
6.  quadra (text): Quadra cadastral.
7.  lote_geo (text): Lote na prefeitura.
8.  loteamento (text): Nome da Vila/Loteamento.
9.  bairro (text): Nome do Bairro oficial.
10. endereco (text): Logradouro e Número principal.
11. building_name (text): Nome do Edifício/Condomínio.
12. floors (int): Número de andares.
13. build_year (int): Ano de construção (Idade predial).
14. cnpj_edificio (varchar): CNPJ do prédio para automação.
15. valor_condominio (numeric): Taxa mensal média.
16. valor_m2 (numeric): Valor de mercado por m² do lote.
17. matricula_mae (text): Matrícula principal do terreno (cartório).
18. area_terreno (numeric): Área do terreno em m².
19. image_url (text): URL da foto principal da fachada.
20. gallery (jsonb): Array de fotos adicionais.
21-24. minx, miny, maxx, maxy (numeric): Geometria UTM 23S.
-- INFRAESTRUTURA (Flags booleanas):
25. piscina (bool)
26. academia (bool)
27. elevador (bool)
28. portaria_24h (bool)
29. churrasqueira (bool)
30. salao_jogos (bool)
31. salao_festas (bool)
32. servico_praia (bool)
33. zeladoria (bool)
34. bicicletario (bool)
35. acesso_pcd (bool)
36. area_verde (bool)
37. amenities (text): Lazer adicional (texto livre).
38. zelador_nome (text): Nome do responsável.
39. zelador_contato (text): Telefone do prédio.
40. obs (text): Observações internas.
41. created_at / updated_at (timestamp).

--------------------------------------------------------------------------------
-- TABELA: public.unidades
-- RLS: Mascarado (Leitura) | Admin (Escrita)
--------------------------------------------------------------------------------
1.  id (uuid): ID interno da unidade.
2.  inscricao (varchar): ID de 11 dígitos.
3.  lote_inscricao (varchar): FK para lotes.
4.  complemento (text): Apto, Bloco, Torre.
5.  tipo (text): Residencial, Comercial, Garagem.
6.  status_venda (text): Disponível, Vendido, Suspenso.
7.  quartos (int): Dormitórios.
8.  suites (int): Suítes.
9.  vagas (int): Vagas de garagem.
10. banheiros (int): Banheiros totais.
11. metragem (numeric): Área privativa (campo legado).
12. area_util (numeric): M2 úteis privativos.
13. area_total (numeric): M2 totais com terraço/garagem.
14. valor_venal (numeric): Valor IPTU.
15. valor_venal_edificado (numeric): Valor venal da construção.
16. valor_real (numeric): Valor de Mercado estimado.
17. valor_vendavel (numeric): Valor anunciado para venda.
18. fracao_ideal (numeric): % da fração ideal do terreno.
19. matricula (text): Registro de Imóveis (Master Only).
20. matricula_qualificacao (text): Apto ou Vaga.
21. rip (text): Registro Marinha/SPU (Master Only).
22. rip_cpf (varchar): CPF Secundário RIP (Master Only).
23. rip_qualificacao (text): Apto ou Vaga.
24. proprietario_id (uuid): FK Proprietários (Admin Only).
25. cpf_cnpj (text): Documento (Mascarado).
26. nome_proprietario (text): Nome (Mascarado).
27. contato_proprietario (text[]): Contatos (Master Only).
28. cep (varchar): CEP da unidade.
29. bairro_unidade (text): Bairro da unidade.
30. endereco_completo (text): String concatenada.
31. logradouro (text): Rua.
32. numero (text): Número predial.
33. cod_ref (text): Referência anúncio.
34. link_url (text): Link externo.
35. imagens (jsonb): Fotos internas.
36. arquivos (jsonb): Documentos gerais.
37. caracteristicas (text[]): Tags de características.
38. descricao_imovel (text): Texto descritivo.
39. created_at (timestamp).

--------------------------------------------------------------------------------
-- TABELAS DE GESTÃO E AUDITORIA (Comentadas individualmente no SQL)
--------------------------------------------------------------------------------
- proprietarios: Cadastro central de pessoas.
- leads: CRM (Owner-Only).
- perfis: Usuários e Permissões.
- unlocked_persons: Log de acessos pagos.
- user_unit_edits: Auditoria de alterações sugeridas.
- admin_messages: Suporte interno.
- ai_history: Histórico GuaruBot.
- analytics_events: Telemetria de uso.
- app_settings: Configurações globais.
