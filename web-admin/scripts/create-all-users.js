const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function createAllUsers() {
  const usersFile = path.join(__dirname, '..', 'data', 'users.json');
  
  console.log('🔐 Creating password hashes...');
  
  // Hash todas as senhas
  const adminHash = await bcrypt.hash('admin', 10);
  const managerHash = await bcrypt.hash('manager', 10);
  const viewerHash = await bcrypt.hash('viewer', 10);
  
  const allUsers = {
    users: [
      {
        id: "admin",
        email: "admin@displayops.com",
        name: "Administrator",
        password: adminHash,
        role: "admin",
        sites: ["*"],
        createdAt: new Date().toISOString(),
        lastLogin: null
      },
      {
        id: "manager_rio",
        email: "manager.rio@displayops.com", 
        name: "Rio Site Manager",
        password: managerHash,
        role: "site-manager",
        sites: ["rio"],
        createdAt: new Date().toISOString(),
        lastLogin: null
      },
      {
        id: "manager_nyc",
        email: "manager.nyc@displayops.com",
        name: "NYC Site Manager", 
        password: managerHash,
        role: "site-manager",
        sites: ["nyc"],
        createdAt: new Date().toISOString(),
        lastLogin: null
      },
      {
        id: "viewer",
        email: "viewer@displayops.com",
        name: "Viewer User",
        password: viewerHash,
        role: "viewer", 
        sites: ["rio", "nyc"],
        createdAt: new Date().toISOString(),
        lastLogin: null
      }
    ]
  };

  // Criar diretório data se não existir
  const dataDir = path.dirname(usersFile);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory');
  }

  // Salvar arquivo
  fs.writeFileSync(usersFile, JSON.stringify(allUsers, null, 2));
  
  console.log('✅ All users created successfully!\n');
  
  console.log('👑 ADMIN USER:');
  console.log('   📧 Email: admin@displayops.com');
  console.log('   🔑 Password: admin');
  console.log('   🏢 Access: All sites\n');
  
  console.log('👨‍💼 SITE MANAGERS:');
  console.log('   📧 Email: manager.rio@displayops.com');
  console.log('   🔑 Password: manager');
  console.log('   🏢 Access: Rio site only\n');
  
  console.log('   📧 Email: manager.nyc@displayops.com');
  console.log('   🔑 Password: manager'); 
  console.log('   🏢 Access: NYC site only\n');
  
  console.log('👁️ VIEWER USER:');
  console.log('   📧 Email: viewer@displayops.com');
  console.log('   🔑 Password: viewer');
  console.log('   🏢 Access: Rio and NYC sites (read-only)\n');
  
  console.log('🚀 All users are ready for login!');
}

// Executar o script
createAllUsers().catch(console.error);