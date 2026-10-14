// Una sola política para comentarios almacenados y leídos, incluida la exportación.
const sanitize = require('sanitize-html');
module.exports = (text) =>
    sanitize(text || '', {
        allowedTags: [
            'a',
            'img',
            'br',
            'p',
            'strong',
            'b',
            'em',
            'ul',
            'ol',
            'li'
        ],
        allowedAttributes: {
            a: ['href', 'target', 'rel'],
            img: ['src', 'alt']
        },
        allowedSchemes: ['http', 'https'],
        allowProtocolRelative: false,
        transformTags: {
            a: (tag, attrs) => ({
                tagName: tag,
                attribs: {
                    ...attrs,
                    rel: 'noopener noreferrer',
                    ...(attrs.target ? { target: '_blank' } : {})
                }
            })
        }
    });
