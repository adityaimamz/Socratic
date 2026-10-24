import {spawn} from 'node:child_process';
const next='node_modules/next/dist/bin/next';
function run(args){return spawn(process.execPath,[next,...args],{stdio:'inherit',windowsHide:true,env:process.env});}
const build=run(['build']);
build.on('exit',code=>{if(code){process.exit(code);return;}const server=run(['start','--hostname','127.0.0.1','--port','3100']);for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.kill(signal));server.on('exit',exit=>process.exit(exit??0));});
