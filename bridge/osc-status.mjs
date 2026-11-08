const VALID_STATES=new Set(["idle","working","done","blocked","error"]);
export function herdrOscSequence(state){if(typeof state!=="string"||!VALID_STATES.has(state))return undefined;return `\u001b]7501;state=${state}:app=gentle-pi\u001b\\`;}
function isRpcMode(argv){return Array.isArray(argv)&&argv.some((arg,i)=>arg==="--mode=rpc"||(arg==="--mode"&&argv[i+1]==="rpc"));}
export function emitHerdrStatus(state,{stdout=process.stdout,argv=process.argv,env=process.env}={}){const seq=herdrOscSequence(state);if(!seq||stdout?.isTTY!==true||isRpcMode(argv)||env?.GENTLE_SHELL_INTERACTIVE_HOST==="1")return false;try{stdout.write(seq);return true;}catch{return false;}}
