interface GroceryItem {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
}

interface GoogleSheetsResponse {
  values?: string[][];
}

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
}

// Browser-compatible JWT creation function
const createJWT = async (payload: any, privateKey: string): Promise<string> => {
  // Convert PEM private key to proper format
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  
  let cleanPrivateKey = privateKey;
  if (privateKey.includes(pemHeader)) {
    cleanPrivateKey = privateKey
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/\s/g, "");
  }

  // Import the private key
  const keyData = Uint8Array.from(atob(cleanPrivateKey), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  // Create JWT header and payload
  const header = { alg: "RS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  // Sign the JWT
  const textEncoder = new TextEncoder();
  const data = textEncoder.encode(`${encodedHeader}.${encodedPayload}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, data);
  
  // Convert signature to base64url
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
};

class GoogleSheetsService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private getServiceAccountCredentials = (): ServiceAccountCredentials => {
    const serviceAccountKey = localStorage.getItem('serviceAccountKey');
    console.log('Service Account Key check:', serviceAccountKey ? 'Found' : 'Not found');
    
    if (!serviceAccountKey) {
      throw new Error('Service Account credentials not configured. Please add your service account JSON in settings.');
    }

    try {
      const credentials = JSON.parse(serviceAccountKey);
      if (!credentials.client_email || !credentials.private_key) {
        throw new Error('Invalid service account JSON - missing client_email or private_key');
      }
      return {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
        project_id: credentials.project_id
      };
    } catch (error) {
      console.error('Error parsing service account credentials:', error);
      throw new Error('Invalid service account credentials format');
    }
  }

  private getAccessToken = async (): Promise<string> => {
    // Check if we have a valid token that hasn't expired
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      console.log('Using cached access token');
      return this.accessToken;
    }

    try {
      const credentials = this.getServiceAccountCredentials();
      console.log('Getting new OAuth access token...');
      
      // Create JWT token
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: credentials.client_email,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600, // 1 hour
        iat: now
      };

      const token = await createJWT(payload, credentials.private_key);
      console.log('JWT created successfully');

      // Exchange JWT for access token
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: token
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OAuth token error:', errorText);
        throw new Error(`Failed to get OAuth access token: ${response.status} - ${errorText}`);
      }

      const tokenData = await response.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = Date.now() + (tokenData.expires_in * 1000) - 60000; // Subtract 1 minute for safety
      
      console.log('Successfully obtained OAuth access token');
      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw new Error(`Authentication failed: ${error.message}. Please check your service account configuration.`);
    }
  }

  private getSheetId = (): string => {
    const sheetId = localStorage.getItem('googleSheetsId');
    console.log('Sheet ID check:', sheetId ? 'Found' : 'Not found');
    if (!sheetId) {
      throw new Error('Google Sheet ID not configured. Please check settings.');
    }
    return sheetId;
  }

  private getSheetName = (): string => {
    const sheetName = localStorage.getItem('googleSheetsName') || 'Sheet1';
    console.log('Sheet Name:', sheetName);
    return sheetName;
  }

  private buildApiUrl = (range: string): string => {
    const sheetId = this.getSheetId();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;
    console.log('Built API URL:', url);
    return url;
  }

  private buildBatchUpdateUrl = (): string => {
    const sheetId = this.getSheetId();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`;
    console.log('Built Batch Update URL:', url);
    return url;
  }

  getGroceryItems = async (): Promise<GroceryItem[]> => {
    try {
      console.log('Starting getGroceryItems...');
      const sheetName = this.getSheetName();
      const range = `${sheetName}!A:D`;
      const url = this.buildApiUrl(range);
      const token = await this.getAccessToken();

      console.log('Fetching from URL:', url);
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        
        if (response.status === 403) {
          throw new Error('Access denied. Please ensure your service account has access to the sheet.');
        }
        if (response.status === 404) {
          throw new Error('Sheet not found. Please check your Sheet ID.');
        }
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data: GoogleSheetsResponse = await response.json();
      console.log('API Response data:', data);
      
      if (!data.values || data.values.length === 0) {
        console.log('No data found');
        return [];
      }

      if (data.values.length === 1) {
        console.log('Only header row found');
        return [];
      }

      const items: GroceryItem[] = [];
      
      for (let i = 1; i < data.values.length; i++) {
        const row = data.values[i];
        console.log(`Processing row ${i}:`, row);
        
        if (!row || row.length === 0 || !row[0] || row[0].trim() === '') {
          continue;
        }
        
        const itemName = row[0]?.trim() || '';
        const quantity = row[1]?.trim() || '';
        const category = row[2]?.trim() || '';
        
        if (itemName && itemName.toLowerCase() !== 'item') {
          items.push({
            id: `item_${i}_${itemName}`,
            name: itemName,
            quantity,
            category,
          });
        }
      }

      console.log('Processed items:', items);
      return items;
    } catch (error) {
      console.error('Error fetching grocery items:', error);
      throw error;
    }
  }

  addGroceryItem = async (item: GroceryItem): Promise<void> => {
    try {
      console.log('Adding item:', item);
      const sheetName = this.getSheetName();
      const token = await this.getAccessToken();
      const url = this.buildBatchUpdateUrl();
      
      // Get current data to find the next empty row
      const currentItems = await this.getGroceryItems();
      const nextRow = currentItems.length + 2; // +1 for header, +1 for next empty row
      
      const range = `${sheetName}!A${nextRow}:D${nextRow}`;
      
      const requestBody = {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: range,
            values: [[item.name, item.quantity || '', item.category || '', '']]
          }
        ]
      };

      console.log('Sending request to:', url);
      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Add item error response:', errorText);
        throw new Error(`Failed to add item: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Add item success:', result);
      
    } catch (error) {
      console.error('Error adding grocery item:', error);
      throw error;
    }
  }

  deleteGroceryItem = async (itemId: string): Promise<void> => {
    try {
      console.log('Deleting item with ID:', itemId);
      
      // Parse the row number from the item ID
      const rowMatch = itemId.match(/item_(\d+)_/);
      if (!rowMatch) {
        throw new Error('Invalid item ID format');
      }
      
      const rowIndex = parseInt(rowMatch[1]) + 1; // +1 because we start from row 1, not 0
      const sheetName = this.getSheetName();
      const token = await this.getAccessToken();
      const url = this.buildBatchUpdateUrl();
      
      const range = `${sheetName}!A${rowIndex}:D${rowIndex}`;
      
      const requestBody = {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: range,
            values: [['', '', '', '']] // Clear the row
          }
        ]
      };

      console.log('Sending delete request to:', url);
      console.log('Clearing range:', range);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete item error response:', errorText);
        throw new Error(`Failed to delete item: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Delete item success:', result);
      
    } catch (error) {
      console.error('Error deleting grocery item:', error);
      throw error;
    }
  }

  reorderGroceryItems = async (reorderedItems: GroceryItem[]): Promise<void> => {
    try {
      console.log('Reordering items:', reorderedItems);
      const sheetName = this.getSheetName();
      const token = await this.getAccessToken();
      const url = this.buildBatchUpdateUrl();
      
      // Clear existing data (except header)
      const clearRange = `${sheetName}!A2:D${reorderedItems.length + 1}`;
      
      // Prepare the new data
      const values = reorderedItems.map(item => [
        item.name,
        item.quantity || '',
        item.category || '',
        ''
      ]);
      
      const requestBody = {
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: clearRange,
            values: values
          }
        ]
      };

      console.log('Sending reorder request to:', url);
      console.log('Reordering range:', clearRange);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Reorder items error response:', errorText);
        throw new Error(`Failed to reorder items: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Reorder items success:', result);
      
    } catch (error) {
      console.error('Error reordering grocery items:', error);
      throw error;
    }
  }

  testConnection = async (): Promise<boolean> => {
    try {
      await this.getGroceryItems();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
