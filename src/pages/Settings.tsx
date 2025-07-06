import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Eye, EyeOff, Upload } from 'lucide-react'; // Removed CheckCircle
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
// import { Separator } from '@/components/ui/separator'; // No longer needed
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Link, useNavigate } from 'react-router-dom';

const Settings = () => {
  const [sheetId, setSheetId] = useState('');
  const [sheetName, setSheetName] = useState('Sheet1');
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [showServiceAccount, setShowServiceAccount] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Load saved settings from localStorage
    const savedSheetId = localStorage.getItem('googleSheetsId') || '';
    const savedSheetName = localStorage.getItem('googleSheetsName') || 'Sheet1';
    const savedServiceAccountKey = localStorage.getItem('serviceAccountKey') || '';
    
    setSheetId(savedSheetId);
    setSheetName(savedSheetName);
    setServiceAccountKey(savedServiceAccountKey);
  }, []);

  const handleSave = async () => {
    if (!sheetId.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter Sheet ID",
        variant: "destructive",
      });
      return;
    }

    // Validate service account JSON if provided
    if (serviceAccountKey.trim()) {
      try {
        const credentials = JSON.parse(serviceAccountKey);
        if (!credentials.client_email || !credentials.private_key) {
          throw new Error('Missing required fields');
        }
      } catch (error) {
        toast({
          title: "Invalid Service Account",
          description: "Please provide valid JSON with client_email and private_key",
          variant: "destructive",
        });
        return;
      }
    } else {
      toast({
        title: "Service Account Required",
        description: "Please provide your service account JSON for write operations",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Save to localStorage
      localStorage.setItem('googleSheetsId', sheetId.trim());
      localStorage.setItem('googleSheetsName', sheetName.trim());
      localStorage.setItem('serviceAccountKey', serviceAccountKey.trim());
      
      toast({
        title: "Settings Saved",
        description: "Configuration saved successfully! Redirecting to home...",
      });

      // Redirect to home page after a short delay
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const extractSheetIdFromUrl = (url: string) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  };

  const handleSheetIdChange = (value: string) => {
    // If it looks like a full URL, extract the ID
    if (value.includes('docs.google.com/spreadsheets')) {
      const extractedId = extractSheetIdFromUrl(value);
      setSheetId(extractedId);
    } else {
      setSheetId(value);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setServiceAccountKey(content);
      };
      reader.readAsText(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid JSON file",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mr-3 p-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <Card className="p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Google Sheets Configuration</h2>
          
          <div className="space-y-4">
            {/* Service Account JSON */}
            <div>
              <Label htmlFor="serviceAccount" className="text-sm font-medium">
                Service Account JSON *
              </Label>
              <div className="mt-1">
                <Textarea
                  id="serviceAccount"
                  value={showServiceAccount ? serviceAccountKey : serviceAccountKey ? '***SERVICE ACCOUNT CONFIGURED***' : ''}
                  onChange={(e) => setServiceAccountKey(e.target.value)}
                  placeholder="Paste your service account JSON here or upload file below"
                  className="min-h-[100px] font-mono text-xs"
                  readOnly={!showServiceAccount && serviceAccountKey.length > 0}
                />
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowServiceAccount(!showServiceAccount)}
                  >
                    {showServiceAccount ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {showServiceAccount ? 'Hide' : 'Show'}
                  </Button>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="fileUpload"
                    />
                    <Label htmlFor="fileUpload">
                      <Button variant="outline" size="sm" type="button" className="cursor-pointer">
                        <Upload className="h-3 w-3 mr-1" />
                        Upload JSON
                      </Button>
                    </Label>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Required for add/delete operations
              </p>
            </div>

            {/* Sheet ID Input */}
            <div>
              <Label htmlFor="sheetId" className="text-sm font-medium">
                Google Sheet ID *
              </Label>
              <Input
                id="sheetId"
                value={sheetId}
                onChange={(e) => handleSheetIdChange(e.target.value)}
                placeholder="Sheet ID or full Google Sheets URL"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                You can paste the full URL or just the sheet ID
              </p>
            </div>

            {/* Sheet Name Input */}
            <div>
              <Label htmlFor="sheetName" className="text-sm font-medium">
                Sheet Name
              </Label>
              <Input
                id="sheetName"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Sheet1"
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                The name of the specific sheet tab (default: Sheet1)
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save & Go Home'}
            </Button>
          </div>
        </Card>

        {/* Removed the "Setup Instructions" section below */}
        {/*
        <Card className="p-6 mt-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            Quick Setup Guide
          </h3>
          
          <div className="space-y-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-2">Step 1: Create Service Account</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Go to Google Cloud Console</li>
                <li>Create a new service account</li>
                <li>Download the JSON key file</li>
                <li>Upload or paste the JSON above</li>
              </ul>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">Step 2: Share Your Sheet</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Open your Google Sheet</li>
                <li>Click "Share" button</li>
                <li>Add your service account email</li>
                <li>Give it "Editor" permissions</li>
              </ul>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">Step 3: Sheet Format</h4>
              <p className="ml-2">
                Your Google Sheet should have headers in the first row:
                <br />
                <span className="font-mono bg-white px-2 py-1 rounded mt-1 inline-block">
                  Item | Quantity | Category
                </span>
              </p>
            </div>
          </div>
        </Card>
        */}
      </div>
    </div>
  );
};

export default Settings;
