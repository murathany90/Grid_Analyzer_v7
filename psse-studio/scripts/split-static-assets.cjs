// One-time readability migration; not part of the normal build.
const fs=require('node:fs'),path=require('node:path'),parser=require('@babel/parser'),traverse=require('@babel/traverse').default,generate=require('@babel/generator').default,t=require('@babel/types');
for(const file of ['src/modules/psse/ui/studio-results.js','src/modules/psse/ui/studio-assets.js','src/modules/psse/shared/retained-support.js','src/modules/psse/calculations/solver.worker.js']){
  const ast=parser.parse(fs.readFileSync(file,'utf8'),{sourceType:'module'}),imports=[];let serial=0;
  traverse(ast,{StringLiteral(p){
    if(p.node.value.length<8000)return;
    const target=p.parentPath.isAssignmentExpression()?p.parentPath.node.left:null,name=target?.property?.name??'binary-'+ ++serial,id='asset_'+name.replace(/\W/g,'_'),assetPath='src/modules/psse/assets/'+path.basename(file).replace(/\.js$/,'')+'-'+name+'.txt';
    fs.mkdirSync(path.dirname(assetPath),{recursive:true});fs.writeFileSync(assetPath,p.node.value);
    imports.push(t.importDeclaration([t.importDefaultSpecifier(t.identifier(id))],t.stringLiteral('../assets/'+path.basename(assetPath))));p.replaceWith(t.identifier(id));p.skip();
  },AssignmentExpression(p){
    if(p.node.left?.property?.name==='Og'&&t.isObjectExpression(p.node.right)&&generate(p.node.right).code.length>100000){
      // This literal only contains geographic coordinates and string metadata.
      const data=Function('return ('+generate(p.node.right).code+')')(),assetPath='src/shared/assets/turkey-basemap.json';fs.mkdirSync(path.dirname(assetPath),{recursive:true});fs.writeFileSync(assetPath,JSON.stringify(data));imports.push(t.importDeclaration([t.importDefaultSpecifier(t.identifier('turkeyBasemap'))],t.stringLiteral('../../../shared/assets/turkey-basemap.json')));p.node.right=t.identifier('turkeyBasemap');
    }
  }});
  ast.program.body.unshift(...imports);fs.writeFileSync(file,generate(ast,{comments:true,compact:false}).code+'\n');console.log(file,imports.length,'assets');
}
