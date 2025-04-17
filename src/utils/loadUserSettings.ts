/**
 * Utility to load user settings from Looker user attributes
 * Works for all users regardless of admin status
 */
export const loadUserSettings = async (core40SDK: any, extensionSDK: any): Promise<void> => {
  try {
    const extensionId = extensionSDK?.lookerHostData?.extensionId;
    if (!extensionId) {
      console.error('Extension ID not available');
      return;
    }
    
    // Convert model_application to lowercase for use in attribute names
    const model_application = extensionId.replace(/::/g, '_').replace(/-/g, '_').toLowerCase();

    // Get user attribute values
    const myUserId = await core40SDK.ok(core40SDK.me());
    console.log('Loading settings for user:', myUserId.id);

    const userAttributeValues = await core40SDK.ok(
      core40SDK.user_attribute_user_values({
        user_id: myUserId.id || '',
        fields: "name, value, user_attribute_id",
        all_values: true
      })
    );
    
    console.log('User attribute values loaded:', userAttributeValues.length);

    // Map user attribute values to their corresponding settings
    const settingsMap: Record<string, string> = {
      'vertex_project': '',
      'vertex_location': 'us-central1', // Default
      'vertex_model': 'gemini-1.5-flash', // Default
      'google_oauth_client_id': ''
    };

    // Check each user attribute for matching settings
    let foundClientId = false;
    userAttributeValues.forEach((attr: any) => {
      if (attr.name && attr.name.toLowerCase().startsWith(`${model_application}_`)) {
        // Use case-insensitive matching for attribute names
        const settingKey = attr.name.toLowerCase().replace(`${model_application}_`, '');
        const value = attr.value;
        
        // Only process specific settings
        if (settingsMap.hasOwnProperty(settingKey) && value) {
          console.log(`Loaded setting from user attributes: ${settingKey}`);
          settingsMap[settingKey] = value;
          
          // Store in localStorage for easy access
          localStorage.setItem(settingKey, value);
          
          // Track if we found a client ID
          if (settingKey === 'google_oauth_client_id') {
            foundClientId = true;
          }
        }
      }
    });

    // Set any default values for empty settings
    if (!settingsMap.vertex_location) {
      localStorage.setItem('vertex_location', 'us-central1');
    }
    if (!settingsMap.vertex_model) {
      localStorage.setItem('vertex_model', 'gemini-1.5-flash');
    }
    
    console.log(`Client ID ${foundClientId ? 'found' : 'not found'} in user attributes`);
    return foundClientId;

  } catch (error) {
    console.error('Error loading user attribute values:', error);
    return false;
  }
};
