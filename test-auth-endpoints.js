
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testAuthEndpoints() {
  console.log('Testing auth endpoints...\n');
  
  try {
    // Test health endpoint first
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', healthResponse.data);
    
    // Test registration
    console.log('\n2. Testing registration endpoint...');
    const registerData = {
      fullName: 'Test User',
      email: `test${Date.now()}@example.com`,
      phone: '+2348012345678',
      password: 'TestPassword123',
      role: 'CONSUMER'
    };
    
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, registerData);
    console.log('✅ Registration successful:', registerResponse.data);
    
    // Test login endpoint structure
    console.log('\n3. Testing login endpoint structure...');
    try {
      await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'nonexistent@example.com',
        password: 'wrongpassword'
      });
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Login endpoint responding correctly (401 for invalid credentials)');
      } else {
        console.log('❌ Login endpoint error:', error.message);
      }
    }
    
    console.log('\n✅ All auth endpoints are accessible and responding correctly!');
    
  } catch (error) {
    if (error.response) {
      console.log('❌ API Error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Network Error:', error.message);
    }
    process.exit(1);
  }
}

testAuthEndpoints();
