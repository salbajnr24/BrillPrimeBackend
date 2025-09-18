
const axios = require('axios');

const BASE_URL = 'http://0.0.0.0:5000';

const testEndpoints = [
  { method: 'GET', path: '/health', name: 'Health Check' },
  { method: 'GET', path: '/api', name: 'API Documentation' },
  { method: 'GET', path: '/api/realtime/health', name: 'Real-time API Health' },
];

async function testAllEndpoints() {
  console.log('🧪 Testing BrillPrime Backend Endpoints...\n');
  
  for (const endpoint of testEndpoints) {
    try {
      const response = await axios({
        method: endpoint.method,
        url: `${BASE_URL}${endpoint.path}`,
        timeout: 5000,
      });
      
      console.log(`✅ ${endpoint.name}: ${response.status} - ${response.data.message || 'OK'}`);
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ ${endpoint.name}: Server not running`);
      } else {
        console.log(`❌ ${endpoint.name}: ${error.response?.status || 'Error'} - ${error.message}`);
      }
    }
  }
  
  console.log('\n🎉 Endpoint testing completed!');
}

testAllEndpoints();
