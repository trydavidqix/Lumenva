import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Configuração
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID; // Passe o ID do projeto via env var
const ENV_FILE_PATH = path.resolve(__dirname, '../secrets-prod.env');

async function migrateSecrets() {
  if (!PROJECT_ID) {
    console.error('ERRO: Defina a variável GOOGLE_CLOUD_PROJECT_ID antes de rodar o script.');
    process.exit(1);
  }

  if (!fs.existsSync(ENV_FILE_PATH)) {
    console.error(`ERRO: Ficheiro não encontrado: ${ENV_FILE_PATH}`);
    process.exit(1);
  }

  console.log(`\n🚀 A iniciar migração para o Google Secret Manager (Projeto: ${PROJECT_ID})`);
  
  const client = new SecretManagerServiceClient();
  const envConfig = dotenv.parse(fs.readFileSync(ENV_FILE_PATH));
  const keys = Object.keys(envConfig);
  
  console.log(`Encontradas ${keys.length} chaves no ficheiro secrets-prod.env\n`);

  for (const key of keys) {
    const value = envConfig[key];
    const secretId = key.replace(/[^a-zA-Z0-9_-]/g, '_'); // Google Cloud restringe nomes
    
    const parent = `projects/${PROJECT_ID}`;
    const secretPath = `${parent}/secrets/${secretId}`;

    try {
      // Verifica se o segredo já existe
      try {
        await client.getSecret({ name: secretPath });
        console.log(`[EXISTE] Segredo ${secretId} já existe. A adicionar nova versão...`);
      } catch (err: any) {
        if (err.code === 5) { // 5 = NOT_FOUND
          // Cria o segredo
          console.log(`[CRIAR] A criar segredo ${secretId}...`);
          await client.createSecret({
            parent: parent,
            secretId: secretId,
            secret: {
              replication: {
                automatic: {},
              },
            },
          });
        } else {
          throw err;
        }
      }

      // Adiciona o valor como uma nova versão
      await client.addSecretVersion({
        parent: secretPath,
        payload: {
          data: Buffer.from(value, 'utf8'),
        },
      });
      
      console.log(`✅ [SUCESSO] Valor injetado para ${secretId}`);
    } catch (error: any) {
      console.error(`❌ [ERRO] Falha ao processar ${secretId}:`, error.message);
    }
  }

  console.log('\n🎉 Migração concluída com sucesso!');
}

migrateSecrets().catch(console.error);
