# Guia de Deploy Firebase - Guarujá GeoMap

## Pré-requisitos

1. **Node.js instalado** (versão 14 ou superior)
2. **Conta Google** para acessar o Firebase Console

## Passos para Deploy

### 1. Instalar Firebase Tools

```powershell
npm install -g firebase-tools
```

### 2. Fazer Login no Firebase

```powershell
firebase login
```

Isso abrirá seu navegador para autenticação com sua conta Google.

### 3. Verificar Configuração

Os arquivos de configuração já foram criados:
- `firebase.json` - Configuração de hosting
- `.firebaserc` - Projeto Firebase (mapaguaruja)
- `.firebaseignore` - Arquivos a ignorar no deploy

### 4. Deploy da Aplicação

```powershell
firebase deploy
```

Ou para deploy apenas do hosting:

```powershell
firebase deploy --only hosting
```

### 5. Acessar a Aplicação

Após o deploy, sua aplicação estará disponível em:
- **URL de Produção**: https://mapaguaruja.web.app
- **URL Alternativa**: https://mapaguaruja.firebaseapp.com

## Configurações Importantes

### Arquivo de Dados Unificado

O sistema agora usa `lotes_merged.json` que combina:
- Dados básicos de `lotes.json`
- Dados detalhados de `lotes_detalhados.json`

Isso resolve o problema de busca por proprietário.

### Cache Headers

Os arquivos estão configurados com cache otimizado:
- **Imagens**: 2 horas
- **JS/CSS**: 1 hora
- **JSON**: 5 minutos

### Firebase Analytics

O Firebase Analytics está integrado e rastreará automaticamente:
- Visualizações de página
- Eventos de usuário
- Tempo de sessão

## Comandos Úteis

### Ver logs de deploy
```powershell
firebase deploy --debug
```

### Testar localmente antes do deploy
```powershell
firebase serve
```

### Ver informações do projeto
```powershell
firebase projects:list
```

### Abrir console do Firebase
```powershell
firebase open
```

## Estrutura de Deploy

```
mapa_interativo/
├── index.html          # Página principal
├── app.js             # Lógica da aplicação
├── styles.css         # Estilos
├── lotes_merged.json  # Dados unificados (46MB)
├── rbush.min.js       # Biblioteca de índice espacial
└── logo.png           # Logo Omega Imóveis
```

## Troubleshooting

### Erro: "Firebase project not found"
Execute: `firebase use mapaguaruja`

### Erro: "Permission denied"
Execute novamente: `firebase login`

### Deploy muito lento
O arquivo `lotes_merged.json` é grande (46MB). O primeiro deploy pode levar alguns minutos.

### Erro 404 após deploy
Aguarde 1-2 minutos para propagação do CDN do Firebase.

## Próximos Passos

1. **Domínio Customizado**: Configure um domínio personalizado no Firebase Console
2. **SSL**: Já incluído automaticamente pelo Firebase
3. **Monitoramento**: Acesse o Firebase Console para ver analytics e performance

## Notas

- O Firebase Hosting é gratuito para até 10GB de armazenamento e 360MB/dia de transferência
- Backups automáticos são mantidos pelo Firebase
- Rollback para versões anteriores disponível no console
