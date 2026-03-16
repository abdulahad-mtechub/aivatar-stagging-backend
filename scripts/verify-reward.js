require('dotenv').config();

const API_URL = `http://localhost:${process.env.PORT || 4000}/api/streaks`;

async function verifyRewardFix() {
  console.log('--- Verifying Reward Points Fix ---');

  try {
    // 1. Test registration with a malformed key (trailing space)
    console.log('\nTest 1: Activity with trailing space in "rule_id " key');
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.argv[2] // Pass token as arg
      },
      body: JSON.stringify({
        "activity_type": "test",
        "rule_id ": 1 // Key with trailing space
      })
    });

    const data = await resp.json();
    if (resp.status === 201) {
      console.log('✅ Success: Activity recorded with robust key handling');
      console.log('Returned rule_id:', data.data.record.rule_id);
      console.log('Reward points:', data.data.reward_points);
    } else {
      console.log('❌ Error: Registration failed with status', resp.status, data.message);
    }

    // 2. Test auto-linking (no rule_id provided)
    console.log('\nTest 2: Auto-linking (no rule_id)');
    const resp2 = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.argv[2]
      },
      body: JSON.stringify({
        "activity_type": "test"
      })
    });

    const data2 = await resp2.json();
    if (data2.data) {
      console.log('✅ Success: Auto-linked correctly');
      console.log('Auto-found rule_id:', data2.data.record.rule_id);
      console.log('Reward points:', data2.data.reward_points);
    }

  } catch (error) {
    console.error('Verification failed:', error.message);
  }
}

if (!process.argv[2]) {
  console.error('Please provide a JWT token as an argument: node scripts/verify-reward.js <YOUR_TOKEN>');
  process.exit(1);
}

verifyRewardFix();
