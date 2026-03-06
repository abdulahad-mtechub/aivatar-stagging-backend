const axios = require('axios');

async function testContactModule() {
  const baseUrl = 'http://localhost:5000/api';
  
  console.log('--- Testing Contact Us Module ---');

  try {
    // 1. Create a contact query
    console.log('\n1. Creating contact query...');
    const createRes = await axios.post(`${baseUrl}/contacts`, {
      name: 'Test User',
      email: 'test@example.com',
      query: 'This is a test query ' + new Date().toISOString()
    });
    console.log('Status:', createRes.status);
    console.log('Response:', JSON.stringify(createRes.data.message, null, 2));

    // Note: Testing admin retrieval would require a token, 
    // which is harder to automate here without hardcoding credentials.
    // I will verify the creation and then suggest the user to test admin retrieval.
    
    console.log('\n✅ Verification of Creation Successful!');
  } catch (error) {
    console.error('\n❌ Verification Failed:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }
}

testContactModule();
