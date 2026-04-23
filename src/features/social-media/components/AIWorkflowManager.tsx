import { useState, useEffect } from "react";
import { supabase } from "../../../lib/supabase/client";
import { useAuth } from "../../../app/providers/AuthProvider";
import { ResellableWorkflowEngine } from "../services/ResellableWorkflowEngine";
import {
  Play,
  Settings,
  Trash2,
  Plus,
  Edit3,
  Copy,
  Pause,
  PlayCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Clock,
  Users,
  Target,
  Zap,
  FileText,
  Calendar,
  BarChart3,
} from "lucide-react";

interface AIWorkflowManagerProps {
  organizationId: string;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  usage_count: number;
  is_active: boolean;
}

interface WorkflowInstance {
  id: string;
  name: string;
  status: string;
  last_run_at?: string;
  next_run_at?: string;
  run_count: number;
  error_count: number;
  last_error?: string;
  ai_workflows?: {
    name: string;
    category: string;
  };
  social_media_accounts?: {
    platform: string;
    username: string;
  };
}

export default function AIWorkflowManager({ organizationId }: AIWorkflowManagerProps) {
  const auth = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newInstance, setNewInstance] = useState({
    name: '',
    config: {},
    workflow_id: '',
    account_id: ''
  });

  useEffect(() => {
    loadData();
  }, [organizationId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load templates
      const { data: templatesData } = await supabase
        .from('ai_workflows')
        .select('*')
        .eq('organization_id', null) // Global templates
        .eq('is_template', true)
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      // Load instances
      const { data: instancesData } = await supabase
        .from('workflow_instances')
        .select(`
          *,
          ai_workflows!inner(
            name,
            category
          ),
          social_media_accounts!inner(
            platform,
            username
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      // Load accounts
      const { data: accountsData } = await supabase
        .from('social_media_accounts')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      setTemplates(templatesData || []);
      setInstances(instancesData || []);
      setAccounts(accountsData || []);
      
      // Set defaults
      if (!selectedAccount && accountsData && accountsData.length > 0) {
        setSelectedAccount(accountsData[0].id);
      }
    } catch (error) {
      console.error('Error loading workflow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async () => {
    if (!selectedTemplate || !selectedAccount) {
      alert('Please select a template and account');
      return;
    }

    try {
      setLoading(true);
      
      const instance = await ResellableWorkflowEngine.createWorkflowInstance(
        selectedTemplate,
        organizationId,
        selectedAccount,
        newInstance.name,
        newInstance.config
      );

      // Reset form
      setNewInstance({
        name: '',
        config: {},
        workflow_id: '',
        account_id: ''
      });
      setShowCreateForm(false);
      setSelectedTemplate('');
      setSelectedAccount('');
      
      await loadData();
      alert('Workflow instance created successfully!');
    } catch (error) {
      console.error('Error creating workflow instance:', error);
      alert('Failed to create workflow instance');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteWorkflow = async (instanceId: string) => {
    try {
      setLoading(true);
      
      const execution = await ResellableWorkflowEngine.executeWorkflow(instanceId);
      
      await loadData();
      
      alert(`Workflow executed successfully! Execution ID: ${execution.execution_id}`);
    } catch (error) {
      console.error('Error executing workflow:', error);
      alert('Failed to execute workflow');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseInstance = async (instanceId: string) => {
    try {
      await ResellableWorkflowEngine.pauseWorkflowInstance(instanceId);
      await loadData();
      alert('Workflow paused successfully!');
    } catch (error) {
      console.error('Error pausing workflow:', error);
      alert('Failed to pause workflow');
    }
  };

  const handleResumeInstance = async (instanceId: string) => {
    try {
      await ResellableWorkflowEngine.resumeWorkflowInstance(instanceId);
      await loadData();
      alert('Workflow resumed successfully!');
    } catch (error) {
      console.error('Error resuming workflow:', error);
      alert('Failed to resume workflow');
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    if (!confirm('Are you sure you want to delete this workflow instance?')) return;

    try {
      await ResellableWorkflowEngine.deleteWorkflowInstance(instanceId);
      await loadData();
      alert('Workflow instance deleted successfully!');
    } catch (error) {
      console.error('Error deleting workflow instance:', error);
      alert('Failed to delete workflow instance');
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      content_generation: FileText,
      scheduling: Calendar,
      analytics: BarChart3,
      engagement: Users,
      growth: TrendingUp,
    };
    return icons[category] || Zap;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500',
      inactive: 'bg-gray-500',
      paused: 'bg-yellow-500',
      error: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">AI Workflow Manager</h1>
              <p className="text-white/60">Manage resellable AI workflows and instances</p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg font-medium text-white transition-colors"
            >
              <Plus size={20} />
              {showCreateForm ? 'Cancel' : 'Create Instance'}
            </button>
          </div>

        {/* Create Instance Form */}
        {showCreateForm && (
          <div className="border border-white/10 bg-white/5 rounded-xl p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Create Workflow Instance</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Select Template</label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Choose a template...</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} - {template.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Select Account</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Choose an account...</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.platform} - {account.username}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Instance Name</label>
                <input
                  type="text"
                  value={newInstance.name}
                  onChange={(e) => setNewInstance({...newInstance, name: e.target.value})}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter instance name..."
                />
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleCreateInstance}
                disabled={loading || !selectedTemplate || !selectedAccount || !newInstance.name}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 rounded-lg font-medium text-white transition-colors"
              >
                <Play size={16} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Creating...' : 'Create Instance'}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Workflow Templates */}
          <div className="border border-white/10 bg-white/5 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <FileText className="text-orange-400" />
              Available Templates
            </h2>
            
            {templates.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No workflow templates available</p>
                <p className="text-white/40 text-sm">Templates will appear here once created</p>
              </div>
            ) : (
              <div className="space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getCategoryIcon(template.category)}
                      <div>
                        <h3 className="text-white font-medium">{template.name}</h3>
                        <p className="text-white/60 text-sm">{template.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                            {template.category}
                          </span>
                          <span className="text-white/40 text-sm">
                            Used {template.usage_count} times
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTemplate(template.id)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded text-sm text-white transition-colors"
                      >
                        <Copy size={14} />
                        Use
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workflow Instances */}
          <div className="border border-white/10 bg-white/5 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <PlayCircle className="text-orange-400" />
              Active Instances
            </h2>
            
            {instances.length === 0 ? (
              <div className="text-center py-12">
                <PlayCircle size={48} className="text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No workflow instances created</p>
                <p className="text-white/40 text-sm">Create instances from templates to automate your workflows</p>
              </div>
            ) : (
              <div className="space-y-4">
                {instances.map((instance) => (
                  <div key={instance.id} className="border border-white/10 bg-white/5 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`}>
                          {instance.status === 'active' && (
                            <div className="w-2 h-2 bg-white rounded-full m-0.5 animate-pulse"></div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-white font-medium">{instance.name}</h3>
                          <p className="text-white/60 text-sm">
                            {instance.ai_workflows?.name} - {instance.social_media_accounts?.platform}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-white/40">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              Last run: {instance.last_run_at ? new Date(instance.last_run_at).toLocaleString() : 'Never'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Target size={12} />
                              Runs: {instance.run_count}
                            </span>
                            {instance.error_count > 0 && (
                              <span className="flex items-center gap-1 text-red-400">
                                <XCircle size={12} />
                                Errors: {instance.error_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {instance.status === 'active' ? (
                          <button
                            onClick={() => handlePauseInstance(instance.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 rounded text-sm text-white transition-colors"
                          >
                            <Pause size={14} />
                            Pause
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResumeInstance(instance.id)}
                            className="flex items-center gap-1 px-3 py-1 bg-green-500 hover:bg-green-600 rounded text-sm text-white transition-colors"
                          >
                            <Play size={14} />
                            Resume
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleExecuteWorkflow(instance.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-orange-500 hover:bg-orange-600 rounded text-sm text-white transition-colors"
                        >
                          <Zap size={14} />
                          Execute
                        </button>
                        
                        <button
                          onClick={() => handleDeleteInstance(instance.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-red-500 hover:bg-red-600 rounded text-sm text-white transition-colors"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>

                    {instance.next_run_at && (
                      <div className="mt-3 p-2 bg-blue-500/10 rounded">
                        <p className="text-blue-400 text-sm">
                          <Calendar size={12} className="inline mr-2" />
                          Next run: {new Date(instance.next_run_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
