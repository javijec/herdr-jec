"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const EVENTS=["SessionStart","UserPromptSubmit","Stop","SessionEnd"];
// Match only commands referring to our exact installed script, including
// the old node and PowerShell quoting variants. Never touch unrelated hooks.
const norm=s=>String(s).replace(/\\/g,"/").replace(/''/g,"'").toLowerCase();
function remove(config,script){
 if(!config?.hooks || typeof config.hooks!=="object")return false;
 const wanted=norm(script);let changed=false;
 for(const event of EVENTS){
   const groups=config.hooks[event];if(!Array.isArray(groups))continue;
   config.hooks[event]=groups.filter(group=>{
     if(!Array.isArray(group?.hooks))return true;
     const before=group.hooks.length;
     group.hooks=group.hooks.filter(h=>{
       if(h?.type!=="command"||typeof h.command!=="string")return true;
       const cmd=norm(h.command);
       return !cmd.includes('"'+wanted+'"')&&!cmd.includes("'"+wanted+"'");
     });
     if(before!==group.hooks.length)changed=true;
     return group.hooks.length>0||before===0;
   });
 }
 return changed;
}
function disable(file,scripts){
 if(!fs.existsSync(file))return false;
 const original=fs.readFileSync(file,"utf8"), config=JSON.parse(original.replace(/^\uFEFF/,""));
 let changed=false;for(const script of scripts)changed=remove(config,script)||changed;
 if(!changed)return false;
 const suffix=Date.now()+"-"+process.pid,backup=file+".jec-disabled-"+suffix,temp=file+".jec-"+suffix+".tmp";
 fs.writeFileSync(backup,original,{flag:"wx"});
 try{
   fs.writeFileSync(temp,JSON.stringify(config,null,2)+"\n",{flag:"wx"});
   if(fs.readFileSync(file,"utf8")!==original)throw Error("hooks.json changed; retry");
   fs.renameSync(temp,file);
 }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 return true;
}
if(require.main===module){
 try{const file=path.join(process.env.CODEX_HOME||path.join(os.homedir(),".codex"),"hooks.json");
 const changed=disable(file,process.argv.slice(2));console.log(changed?"JEC Chat hooks disabled; backup saved.":"No installed JEC Chat hooks found.");}
 catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={remove,disable};
