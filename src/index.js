const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const axios = require("axios")
const userContexts = {}

async function connectToWhatsApp () {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    })

    sock.ev.on ('creds.update', saveCreds)

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if(connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect)
            // reconnect if not logged out
            if(shouldReconnect) {
                connectToWhatsApp()
            }
        } else if(connection === 'open') {
            console.log('opened connection')
        }
    })

    // logica
    

    async function enviarMenuPrincipal(sock, id, nombre){
        await sock.sendMessage(id, { text: `Hola ${ nombre }, Bienvenido\n*Servicio Técnico:*\n- 👉 *A*: Nuestros servicios\n- 👉 *B*: Consulta Soporte?\n- 👉 *C*: Volver al Menu\n\n> Elije una opción`});

    }

    // mensajes
    sock.ev.on('messages.upsert', async m => {
        console.log(JSON.stringify(m, undefined, 2))

        if (m.type == "notify" && !m.messages[0].key.fromMe) {
            const id = m.messages[0].key.remoteJid;
            const nombre = m.messages[0].pushName;
            const mensaje =
              m.messages[0].message?.conversation ||
              m.messages[0].message?.text ||
              m.messages[0].message?.extendedTextMessage;
      
            if (id.includes("@s.whatsapp.net")) {
                
                if(!userContexts[id]) {
                    userContexts[id] = { menuActual: "main" }
                    enviarMenuPrincipal(sock, id, nombre)
                    return;
                }

                const menuActual = userContexts[id].menuActual;

                if(menuActual == "main"){
                    switch (mensaje) {
                        case "A":
                            await sock.sendMessage(id, { text: `Tenemo una variadad de servicios...`});
                            break;
                        case "B":
                            userContexts[id].menuActual = "soporte";
                            await sock.sendMessage(id, { text: `${ nombre }, que soporte necesita?*\n- 👉 *1*: Problemas de inicio de sesión\n- 👉 *2*: Problemas de instalción?\n- 👉 *3*: Volver al Menu\n\n> Elije una opción o escribe si necesitas atención personalizada al nro: +59173277937`});
                            return;
                            break;
                        case "C":
                            userContexts[id].menuActual = "main";
                            enviarMenuPrincipal(sock, id, nombre)
                            return;
                            break;
                    
                        default:
                            const iaRespuesta = await obtenerRespuestaOpenIA(mensaje, id);
                            await sock.sendMessage(id, { text: iaRespuesta});
                            break;
                    }
                } else if(menuActual == "soporte"){
                    switch (mensaje) {
                        case "1":
                            await sock.sendMessage(id, { text: `Para solucionar tu problema debes presionar recuperar contraseña...`});
                            break;
                        case "2":
                            userContexts[id].menuActual = "soporte";
                            await sock.sendMessage(id, { text: `solucionaremos tu problema o escribe si necesitas atención personalizada al nro: +59173277937`});
                            return;
                            break;
                        case "3":
                            userContexts[id].menuActual = "main";
                            enviarMenuPrincipal(sock, id, nombre)
                            return;
                            break;
                    
                        default:
                            const iaRespuesta = await obtenerRespuestaOpenIA(mensaje, id);
                            await sock.sendMessage(id, { text: iaRespuesta});
                            break;
                    }
                }

                // console.log(userContexts);
            }
        }        
    })
}

connectToWhatsApp();

// OPEN AI
const lista_mensajes = [
    {"role": "system", "content": [{ "type": "text", "text": "Actua como un experto en ventas, se cordial. y solo responde a preguntas sobre equipos de computadora. si preguntan sobre otros temas solo responde que no tienes conocimiento y ademas debes responder en menos de 15 palabras"}]},
    {"role": "user", "content": [ {"type": "text", "text": "precio de teclado?"} ]},
    {"role": "assistant", "content": [ {"type": "text", "text": "Ofrecemos solamente Teclados de la marca ASUS, no tenemos otras marcas y el unico precio es de 138 Dólares"} ]},
];

async function obtenerRespuestaOpenIA(mensaje, id_user){

    if(!userContexts[id_user]?.lista_mensajes){
        userContexts[id_user].lista_mensajes = lista_mensajes
    }
    // lista_mensajes.push({"role": "user", "content": [ {"type": "text", "text": mensaje} ]})
    userContexts[id_user].lista_mensajes.push({"role": "user", "content": [ {"type": "text", "text": mensaje} ]}) 

    const respuesta = await axios.post("https://api.openai.com/v1/chat/completions", {
        "model": "gpt-4o",
        "messages": userContexts[id_user].lista_mensajes
    },
    {
        headers: {
            Authorization: `Bearer TOKEN_OPENAI`,
            "Content-Type": "application/json"
        }
    });

    userContexts[id_user].lista_mensajes.push({"role": "assistant", "content": [ {"type": "text", "text": respuesta.data.choices[0].message.content} ]})
    // console.log(userContexts[id_user].lista_mensajes);
    return respuesta.data.choices[0].message.content;

}
