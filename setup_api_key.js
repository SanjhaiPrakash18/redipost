// Secure API Key Setup Script for Redipost Extension
// This script safely stores the OpenRouter API key in Chrome's local storage

(async function setupApiKey() {
  const API_KEY = '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';
  
  try {
    // Validate API key format
    if (!API_KEY.startsWith('sk-or-')) {
      console.error('❌ Invalid API key format. OpenRouter keys should start with "sk-or-"');
      return;
    }
    
    // Store the API key securely in Chrome's local storage
    await chrome.storage.local.set({ 
      openrouter_api_key: API_KEY 
    });
    
    console.log('API key stored successfully!');
    console.log('🔒 Key is securely stored in Chrome local storage');
    console.log('🚀 AI features are now enabled for Redipost');
    
    // Verify storage
    const result = await chrome.storage.local.get(['openrouter_api_key']);
    if (result.openrouter_api_key) {
      console.log('Verification: API key successfully retrieved from storage');
    } else {
      console.error('❌ Verification failed: Could not retrieve API key');
    }
    
  } catch (error) {
    console.error('❌ Failed to store API key:', error);
  }
})();

// Clean up - remove this script after use for security
    console.log('Remember to delete this setup_api_key.js file after running it for security!');
