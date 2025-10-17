import { useState, useEffect, useRef } from 'react';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Save, 
  Cookie, 
  CheckCircle,
  XCircle,
  Globe,
  Upload,
  Shield,
  AlertCircle,
  Info
} from 'lucide-react';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToastContext } from '@/contexts/ToastContext';
import { useToastStore } from '@/stores/toastStore';
import { MiniPC } from '@/types/shared-types';

const NewCookiePage: NextPage = () => {
  const router = useRouter();
  const toast = useToastContext();
  const { addPendingToast } = useToastStore();
  const [hosts, setHosts] = useState<MiniPC[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasInitializedRef = useRef(false);
  
  // Form state
  const [formData, setFormData] = useState({
    domain: '',
    cookies: '',
    replaceAll: false
  });

  // Fetch hosts on component mount
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      fetchHosts();
    }
  }, []);

  const fetchHosts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/hosts');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setHosts(result.data);
        }
      }
    } catch (error) {
      console.error('Error fetching hosts:', error);
      toast.error('Failed to load hosts');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.domain.trim()) {
      toast.error('Domain is required');
      return;
    }

    if (!formData.cookies.trim()) {
      toast.error('Cookie data is required');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/cookies/import-devtools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain: formData.domain.trim(),
          cookies: formData.cookies.trim(),
          replaceAll: formData.replaceAll,
          timestamp: new Date()
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Adiciona toast pendente no Zustand
        addPendingToast({
          type: 'success',
          message: 'Cookies imported successfully!'
        });
        
        // Navega para listagem
        router.push('/cookies');
      } else {
        toast.error('Error importing cookies', data.error || 'Unknown error occurred');
      }
    } catch (err: any) {
      toast.error('Network error', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center mb-2">
                  <Link
                    href="/cookies"
                    className="mr-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <ArrowLeft className="h-6 w-6" />
                  </Link>
                  <h1 className="text-2xl font-bold leading-7 text-gray-900 dark:text-gray-100 sm:truncate sm:text-3xl sm:tracking-tight">
                    Import Authentication Cookies
                  </h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Import cookies from browser DevTools to enable automatic authentication on display devices
                </p>
              </div>
              <div className="ml-6 flex flex-shrink-0">
                <Link
                  href="/cookies"
                  className="inline-flex items-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cookie Import Form */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Cookie Information
                  </h3>
                  
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label htmlFor="domain" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          <Globe className="h-4 w-4 inline mr-2" />
                          Domain <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            id="domain"
                            value={formData.domain}
                            onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                            placeholder="example.com"
                            required
                            disabled={isSubmitting}
                          />
                        </div>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Enter the domain for which these cookies apply (e.g., example.com)
                        </p>
                      </div>
                      
                      <div>
                        <label htmlFor="cookies" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                          <Cookie className="h-4 w-4 inline mr-2" />
                          Cookie Data <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <textarea
                            id="cookies"
                            value={formData.cookies}
                            onChange={(e) => setFormData({ ...formData, cookies: e.target.value })}
                            className="block w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors font-mono"
                            placeholder="Paste cookie table data from browser DevTools here..."
                            rows={8}
                            required
                            disabled={isSubmitting}
                          />
                        </div>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Copy cookie data from browser DevTools (Application → Cookies → Domain)
                        </p>
                      </div>

                      <div>
                        <label className="flex items-start p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={formData.replaceAll}
                            onChange={(e) => setFormData({ ...formData, replaceAll: e.target.checked })}
                            className="mt-1 mr-3"
                            disabled={isSubmitting}
                          />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-gray-100 flex items-center">
                              <Shield className="w-4 h-4 mr-2 text-orange-500" />
                              Replace All Existing Cookies
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              If checked, all existing cookies for this domain will be replaced. Otherwise, cookies will be merged.
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Form Actions */}
                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex justify-end space-x-3">
                        <Link
                          href="/cookies"
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                          Cancel
                        </Link>
                        <button
                          type="submit"
                          disabled={isSubmitting || !formData.domain.trim() || !formData.cookies.trim()}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              {formData.replaceAll ? 'Replacing...' : 'Importing...'}
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              {formData.replaceAll ? 'Replace All Cookies' : 'Import Cookies'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100 mb-4">
                  How to Import Cookies
                </h3>
                
                <div className="space-y-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5 flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">1</span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Login to Website</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Open the website in your browser and login with your credentials
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5 flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">2</span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Open DevTools</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Press F12 or right-click → Inspect → Application → Cookies
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 mt-0.5 flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">3</span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Copy Cookie Data</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Select the domain and copy all cookie table data
                      </p>
                    </div>
                  </div>

                  <div className="flex">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-5 w-5 text-green-400 mt-0.5" />
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Paste & Import</h4>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Paste the data in the form and import to this system
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Available Hosts</h4>
                  {loading ? (
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4"></div>
                    </div>
                  ) : hosts.length > 0 ? (
                    <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                      {hosts.slice(0, 5).map((host, index) => (
                        <li key={index} className="flex items-center">
                          <span className="text-green-500 mr-2">•</span>
                          <span className="truncate">{host.name}</span>
                        </li>
                      ))}
                      {hosts.length > 5 && (
                        <li className="text-xs text-gray-400 dark:text-gray-500 italic">
                          ... and {hosts.length - 5} more hosts
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No display hosts detected
                    </p>
                  )}
                </div>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-medium">Security Note</p>
                      <p className="mt-1 text-xs">
                        Cookies are stored securely and only used for automatic authentication on display devices.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default NewCookiePage;