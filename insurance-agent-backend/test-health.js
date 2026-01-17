import fetch from 'node-fetch';

async function testHealth() {
  try {
    const response = await fetch('https://hushed-magpie-545.convex.cloud/health');
    console.log('Status:', response.status);
    console.log('Body:', await response.text());
  } catch (error) {
    console.error('Error:', error);
  }
}

testHealth();
