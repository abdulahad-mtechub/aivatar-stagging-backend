require('dotenv').config();

const API_URL = `http://localhost:${process.env.PORT || 4000}/api/auth`;

async function testRegistration() {
  console.log('--- Testing Registration with confirm_password ---');
  
  try {
    // 1. Test registration with mismatched passwords
    console.log('\nTest 1: Mismatched passwords');
    try {
      const resp = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test' + Date.now() + '@example.com',
          password: 'password123',
          confirm_password: 'wrongpassword'
        })
      });
      const data = await resp.json();
      if (resp.status === 400) {
        console.log('✅ Success: Received expected error (400) for mismatched passwords:', data.message);
      } else {
        console.log('❌ Error: Registration should have failed with 400, but got', resp.status);
      }
    } catch (error) {
      console.log('❌ Unexpected error in Test 1:', error.message);
    }

    // 2. Test registration with missing confirm_password
    console.log('\nTest 2: Missing confirm_password');
    try {
      const resp = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User',
          email: 'test' + Date.now() + '@example.com',
          password: 'password123'
        })
      });
      const data = await resp.json();
      if (resp.status === 400) {
        console.log('✅ Success: Received expected error (400) for missing confirm_password:', data.message);
      } else {
        console.log('❌ Error: Registration should have failed with 400, but got', resp.status);
      }
    } catch (error) {
      console.log('❌ Unexpected error in Test 2:', error.message);
    }

    // 3. Test successful registration
    console.log('\nTest 3: Successful registration');
    const email = 'test' + Date.now() + '@example.com';
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: email,
        password: 'password123',
        confirm_password: 'password123'
      })
    });
    
    const data = await response.json();
    if (response.status === 201) {
      console.log('✅ Success: User registered successfully');
      console.log('Response data:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Error: Registration failed with status', response.status, data.message);
    }

  } catch (error) {
    console.error('Test execution failed:', error.message);
  }
}

async function run() {
  await testRegistration();
}

run();
