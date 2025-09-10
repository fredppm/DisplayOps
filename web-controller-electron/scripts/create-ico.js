// Script para criar ICO usando imagemagick ou alternativa online
const fs = require('fs');
const path = require('path');

console.log('Para resolver o erro do ícone ICO, você tem algumas opções:');
console.log('');
console.log('1. SOLUÇÃO RÁPIDA - Usar PNG temporariamente:');
console.log('   - Editar package.json');
console.log('   - Remover configurações de ícone do NSIS');
console.log('');
console.log('2. CRIAR ICO REAL:');
console.log('   a) Online: https://convertio.co/png-ico/');
console.log('   b) ImageMagick: convert icon.png icon.ico');
console.log('   c) GIMP: Exportar como .ico');
console.log('');
console.log('3. Vou aplicar a solução rápida agora...');

// Ler o package.json
const packagePath = path.join(__dirname, '..', 'package.json');
const packageContent = fs.readFileSync(packagePath, 'utf8');
const packageData = JSON.parse(packageContent);

// Remover configurações problemáticas do NSIS
if (packageData.build && packageData.build.nsis) {
  delete packageData.build.nsis.installerIcon;
  delete packageData.build.nsis.uninstallerIcon;
  
  console.log('✓ Removidas configurações de ícone do NSIS');
}

// Usar ícone PNG para Windows também
if (packageData.build && packageData.build.win) {
  packageData.build.win.icon = "assets/icon.png";
  console.log('✓ Configurado para usar PNG no Windows');
}

// Salvar package.json
fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2));
console.log('✓ Package.json atualizado');
console.log('');
console.log('Agora tente: npm run dist:win');
console.log('');
console.log('IMPORTANTE: Para produção, converta o PNG para ICO real!');