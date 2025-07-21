import { SettingsContextProps, VertexSettings } from '../types';

/**
 * Utility to load user settings from Looker user attributes
 * Works for all users regardless of admin status
 */
export const loadUserSettings = async (
  core40SDK: any, 
  extensionSDK: any
): Promise<VertexSettings | null> => {
  try {
    const extensionId = extensionSDK?.lookerHostData?.extensionId;
    if (!extensionId) {
      console.error('Extension ID not available');
      return null;
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
    const settings: VertexSettings = {
      googleOAuthClientId: '',
      cloudRunUrl: '',
    };

    // Check each user attribute for matching settings
    userAttributeValues.forEach((attr: any) => {
      if (attr.name && attr.name.toLowerCase().startsWith(`${model_application}_`)) {
        // Use case-insensitive matching for attribute names
        const settingKey = attr.name.toLowerCase().replace(`${model_application}_`, '');
        const value = attr.value;
        
        // Map snake_case attribute names back to camelCase
        switch (settingKey) {
          case 'google_oauth_client_id':
            settings.googleOAuthClientId = value || settings.googleOAuthClientId;
            break;
          case 'cloud_run_url':
            settings.cloudRunUrl = value || settings.cloudRunUrl;
            break;
        }
      }
    });

    return settings;
  } catch (error) {
    console.error('Error loading user attribute values:', error);
    return null;
  }
};
