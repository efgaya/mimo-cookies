# Site Mimo Cookies

Site estático, responsivo e pronto para GitHub Pages.

## Antes de publicar

Abra `config.js` e preencha o número do WhatsApp:

```js
whatsappNumber: "559391985864"
```

Use apenas números, incluindo:
- 55 (Brasil)
- DDD
- número com 9 dígitos

## Alterar preços, sabores ou disponibilidade

Edite `products.js`.

Para esgotar um sabor:

```js
available: false
```

## Publicar no GitHub Pages

1. Crie uma conta no GitHub.
2. Crie um repositório público, por exemplo `mimo-cookies`.
3. Envie todos os arquivos desta pasta para a raiz do repositório.
4. Vá em **Settings > Pages**.
5. Em **Build and deployment**, escolha **Deploy from a branch**.
6. Selecione a branch `main` e a pasta `/ (root)`.
7. Salve. Em alguns minutos o site ficará disponível.

## Domínio próprio

Depois, no GitHub:
1. Vá em **Settings > Pages**.
2. Preencha **Custom domain** com o domínio escolhido.
3. No Registro.br, configure os registros DNS indicados pelo GitHub.

## Frete

A versão atual oferece:
- retirada grátis;
- entrega com frete a confirmar pelo WhatsApp.

Quando as faixas de entrega forem definidas, o cálculo pode ser adicionado ao `script.js`.


## Informações da loja

- 1ª cookieteria de Santarém
- Cookies artesanais assados na hora
- Funcionamento: 9h às 21h
