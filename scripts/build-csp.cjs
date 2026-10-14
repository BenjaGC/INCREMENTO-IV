// Compila exclusivamente expresiones del HTML del repositorio. No evalúa strings recibidos en ejecución.
const fs = require('node:fs'),
    path = require('node:path'),
    { Parser } = require('htmlparser2');
const root = path.resolve(__dirname, '..'),
    expressions = new Set(['index']);
function add(value) {
    if (value && value.trim()) expressions.add(value.replace(/\r\n?/g, '\n'));
}
const parser = new Parser({
    onopentag(name, attrs) {
        for (const [attribute, value] of Object.entries(attrs)) {
            if (attribute === 'x-for') {
                const match = value.match(/([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/);
                if (match) add(match[2].trim());
            } else if (
                attribute === 'x-model' ||
                attribute.startsWith('x-model.')
            ) {
                add(value);
                add(value + ' = __placeholder');
            } else if (
                attribute.startsWith('@') ||
                attribute.startsWith(':') ||
                /^x-(data|init|text|html|show|if|effect|bind|on|id)(?:[:.]|$)/.test(
                    attribute
                )
            )
                add(value);
        }
    }
});
parser.write(fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'));
parser.end();
const normal = (e) =>
    /^[\n\s]*if.*\(.*\)/.test(e.trim()) || /^(let|const)\s/.test(e.trim())
        ? `(async()=>{ ${e} })()`
        : e;
const entries = [...expressions].map(
    (e) =>
        `${JSON.stringify(e)}: async function(__self,scope){with(scope){__self.result=${normal(e)}}__self.finished=true;return __self.result;}`
);
const raw = [...expressions]
    .filter((e) => !e.includes('await'))
    .map(
        (e) =>
            `${JSON.stringify(e)}:function(scope){with(scope){let __result=${normal(e)};return __result;}}`
    );
const runtime = `// Generado por npm run build:csp; volver a generar después de cambiar directivas HTML.
(()=>{
const compiled={${entries.join(',\n')}};
const raw={${raw.join(',\n')}};
document.addEventListener('alpine:init',()=>{
 const A=window.Alpine;
 const scope=(el,extra={})=>{const magic={};A.injectMagics(magic,el);return A.mergeProxies([extra,magic,...A.closestDataStack(el)]);};
 const deliver=(receiver,value,context,params)=>{if(value instanceof Promise)return value.then(v=>deliver(receiver,v,context,params));if(typeof value==='function')return deliver(receiver,value.apply(context,params),context,params);receiver(value);};
 A.setEvaluator((el,expression)=>(receiver=()=>{},options={})=>{
  const context=scope(el,options.scope),params=options.params||[];
  try{
   if(typeof expression==='function')return deliver(receiver,expression.apply(context,params),context,params);
   const fn=compiled[expression];if(!Object.prototype.hasOwnProperty.call(compiled,expression))throw Error('Expresión no compilada: '+expression);
   const state={finished:false,result:undefined};const promise=fn.call(options.context,state,context);
   if(state.finished)deliver(receiver,state.result,context,params);else promise.then(v=>deliver(receiver,v,context,params)).catch(e=>A.handleError(e,el,expression));
  }catch(e){A.handleError(e,el,expression);}
 });
 A.setRawEvaluator((el,expression,options={})=>{
  if(!Object.prototype.hasOwnProperty.call(raw,expression))throw Error('Expresión no compilada: '+expression);
  const context=scope(el,options.scope),result=raw[expression].call(options.context,context);
  return typeof result==='function'?result.apply(context,options.params||[]):result;
 });
});})();`;
fs.writeFileSync(path.join(root, 'public/js/csp-expressions.js'), runtime);
console.log('Expresiones compiladas para CSP: ' + expressions.size);
