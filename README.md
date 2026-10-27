# Receitas da Família

O caderno de receitas da família, para usar no telemóvel (Android ou iPhone) e no computador.

- Fotografar receitas em papel ou de livros (várias páginas) e o assistente de IA passa-as a texto.
- Importar receitas de ficheiros Word (.docx).
- Procurar por categoria, ingrediente, pessoa ou livro, e pelo que tem em casa.
- Fotografias do resultado e de cada passo, e partilha (WhatsApp, email…).
- Modo cozinha: passo a passo, letra grande, ecrã sempre ligado e temporizadores.
- Assistente (Gemini): substituir ingredientes, melhorar e adaptar receitas, calorias por ingrediente, por dose e total, alergias e dietas (celíacos, diabéticos, lactose…).
- Receitas partilhadas pela família através do Firebase (plano gratuito), e funciona sem internet.

## Ficheiros

| Ficheiro | Para quê |
|---|---|
| `js/config.js` | **O único ficheiro que precisa de editar:** cole aqui a configuração do Firebase. |
| `firestore.rules` | Regras de segurança a colar na consola do Firebase (troque o email). |
| `index.html`, `css/`, `js/`, `icons/` | A app. |
| `sw.js` | Permite abrir a app sem internet. Ao mudar a app, aumente a versão no topo. |

Sem a configuração do Firebase, a app funciona em **modo local** (receitas só no aparelho), útil para experimentar.

Siga o guia de instalação passo a passo para publicar no GitHub Pages e ligar o Firebase e o Gemini.
