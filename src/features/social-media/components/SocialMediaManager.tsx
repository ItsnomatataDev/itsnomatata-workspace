import { useState } from "react";
import {
  Wand2,
  Copy,
  Check,
  Clock,
  TrendingUp,
  Target,
  MessageSquare,
  Hash,
  Calendar,
  BarChart3,
  Lightbulb,
  Sparkles,
  Send,
  RefreshCw,
  Download,
} from "lucide-react";
import { AISocialMediaManager, type SocialMediaContext, type ContentStrategy } from "../services/AISocialMediaManager";

interface SocialMediaManagerProps {
  onContentGenerated?: (strategy: ContentStrategy) => void;
}

export default function SocialMediaManager({ onContentGenerated }: SocialMediaManagerProps) {
  const [context, setContext] = useState<SocialMediaContext>({
    brandName: "",
    industry: "business",
    targetAudience: "General audience",
    toneOfVoice: "friendly",
    currentCampaign: "",
    platform: "instagram",
    contentType: "post",
    goal: "engagement",
    pastPerformance: undefined,
  });

  const [strategy, setStrategy] = useState<ContentStrategy | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [engagementResponse, setEngagementResponse] = useState<string | null>(null);

  const industries = [
    "Tech", "Fashion", "Food", "Fitness", "Beauty", "Business", "Travel", "Lifestyle"
  ];

  const tones = [
    { value: "bold", label: "Bold & Confident" },
    { value: "friendly", label: "Friendly & Approachable" },
    { value: "luxury", label: "Luxury & Elegant" },
    { value: "funny", label: "Funny & Witty" },
    { value: "professional", label: "Professional & Authoritative" },
    { value: "casual", label: "Casual & Relaxed" },
  ];

  const platforms = [
    { value: "facebook", label: "Facebook" },
    { value: "instagram", label: "Instagram" },
    { value: "both", label: "Both Platforms" },
  ];

  const contentTypes = [
    { value: "post", label: "Standard Post" },
    { value: "reel", label: "Instagram Reel" },
    { value: "story", label: "Story" },
    { value: "ad", label: "Advertisement" },
  ];

  const goals = [
    { value: "engagement", label: "Maximize Engagement" },
    { value: "traffic", label: "Drive Traffic" },
    { value: "sales", label: "Generate Sales" },
    { value: "awareness", label: "Increase Awareness" },
  ];

  const handleGenerateStrategy = async () => {
    if (!context.brandName.trim()) {
      alert("Please enter your brand name");
      return;
    }

    setLoading(true);
    try {
      const result = await AISocialMediaManager.generateContentStrategy(context);
      setStrategy(result);
      onContentGenerated?.(result);
    } catch (error) {
      console.error("Error generating strategy:", error);
      alert("Failed to generate content strategy. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerateResponse = async () => {
    if (!comment.trim() || !context.brandName.trim()) {
      alert("Please enter both brand name and comment");
      return;
    }

    try {
      const response = await AISocialMediaManager.generateEngagementResponse(comment, context);
      setEngagementResponse(response.response);
    } catch (error) {
      console.error("Error generating response:", error);
      alert("Failed to generate response. Please try again.");
    }
  };

  const formatHashtags = (hashtags: string[]) => {
    return hashtags.join(" ");
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Wand2 className="text-orange-400" />
              AI Social Media Manager
            </h1>
            <p className="text-white/60 mt-1">Create high-performing content with AI-powered strategy</p>
          </div>
        </div>

        {/* Input Form */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
            <Target className="text-orange-400" />
            Campaign Context
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Brand Name */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Brand Name *
              </label>
              <input
                type="text"
                value={context.brandName}
                onChange={(e) => setContext({ ...context, brandName: e.target.value })}
                placeholder="Enter your brand name"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-500/50"
              />
            </div>

            {/* Industry */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Industry
              </label>
              <select
                value={context.industry}
                onChange={(e) => setContext({ ...context, industry: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500/50"
              >
                {industries.map((industry) => (
                  <option key={industry} value={industry.toLowerCase()}>
                    {industry}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Target Audience
              </label>
              <input
                type="text"
                value={context.targetAudience}
                onChange={(e) => setContext({ ...context, targetAudience: e.target.value })}
                placeholder="e.g., Young professionals, Parents"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-500/50"
              />
            </div>

            {/* Tone of Voice */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Tone of Voice
              </label>
              <select
                value={context.toneOfVoice}
                onChange={(e) => setContext({ ...context, toneOfVoice: e.target.value as any })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500/50"
              >
                {tones.map((tone) => (
                  <option key={tone.value} value={tone.value}>
                    {tone.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Platform
              </label>
              <select
                value={context.platform}
                onChange={(e) => setContext({ ...context, platform: e.target.value as any })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500/50"
              >
                {platforms.map((platform) => (
                  <option key={platform.value} value={platform.value}>
                    {platform.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Content Type */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Content Type
              </label>
              <select
                value={context.contentType}
                onChange={(e) => setContext({ ...context, contentType: e.target.value as any })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500/50"
              >
                {contentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Goal */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Primary Goal
              </label>
              <select
                value={context.goal}
                onChange={(e) => setContext({ ...context, goal: e.target.value as any })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-orange-500/50"
              >
                {goals.map((goal) => (
                  <option key={goal.value} value={goal.value}>
                    {goal.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Current Campaign */}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-white/80 mb-2">
                Current Campaign (Optional)
              </label>
              <input
                type="text"
                value={context.currentCampaign}
                onChange={(e) => setContext({ ...context, currentCampaign: e.target.value })}
                placeholder="e.g., Summer Sale, Product Launch"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-500/50"
              />
            </div>
          </div>

          {/* Generate Button */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleGenerateStrategy}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Generating Strategy...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Generate Content Strategy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        {strategy && (
          <div className="space-y-6">
            {/* Best Version */}
            <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="text-green-400" />
                Best Performing Version
                <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                  {strategy.bestVersion.predictedPerformance}% predicted performance
                </span>
              </h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white/60 mb-1">Hook</p>
                  <p className="text-white font-medium">{strategy.bestVersion.hook}</p>
                </div>
                
                <div>
                  <p className="text-sm text-white/60 mb-1">Caption</p>
                  <p className="text-white whitespace-pre-wrap">{strategy.bestVersion.caption}</p>
                </div>
                
                <div>
                  <p className="text-sm text-white/60 mb-1">Call to Action</p>
                  <p className="text-white">{strategy.bestVersion.cta}</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">Reasoning:</span>
                    <span className="text-sm text-white/80">{strategy.bestVersion.reasoning}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(
                      `${strategy.bestVersion.hook}\n\n${strategy.bestVersion.caption}\n\n${strategy.bestVersion.cta}`,
                      "best"
                    )}
                    className="flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                  >
                    {copiedId === "best" ? <Check size={14} /> : <Copy size={14} />}
                    {copiedId === "best" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            {/* All Variations */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="text-blue-400" />
                All Content Variations
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {strategy.contentVariations.map((variation) => (
                  <div
                    key={variation.id}
                    className={`p-4 rounded-lg border ${
                      variation.id === strategy.bestVersion.id
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white capitalize">
                        {variation.id.replace("var", "Version ")}
                      </span>
                      <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded-full">
                        {variation.predictedPerformance}% performance
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-white/80">
                        <span className="text-white/60">Hook:</span> {variation.hook}
                      </p>
                      <p className="text-sm text-white/80 line-clamp-3">
                        {variation.caption}
                      </p>
                      <p className="text-sm text-white/80">
                        <span className="text-white/60">CTA:</span> {variation.cta}
                      </p>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-white/60">{variation.reasoning}</span>
                      <button
                        onClick={() => handleCopy(
                          `${variation.hook}\n\n${variation.caption}\n\n${variation.cta}`,
                          variation.id
                        )}
                        className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors"
                      >
                        {copiedId === variation.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === variation.id ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hashtags */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Hash className="text-purple-400" />
                Hashtag Strategy
              </h3>
              
              <div className="space-y-4">
                {strategy.hashtags.map((set, index) => (
                  <div key={index} className="p-4 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white capitalize">
                        {set.type} Hashtags
                      </span>
                      <button
                        onClick={() => handleCopy(formatHashtags(set.hashtags), `hashtags-${index}`)}
                        className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors"
                      >
                        {copiedId === `hashtags-${index}` ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === `hashtags-${index}` ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="text-sm text-white/80 mb-2">{formatHashtags(set.hashtags)}</p>
                    <p className="text-xs text-white/60">{set.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategy Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Posting Schedule */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Calendar className="text-orange-400" />
                  Posting Strategy
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-white/60 mb-1">Optimal Posting Time</p>
                    <p className="text-white font-medium">{strategy.suggestedPostingTime}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-white/60 mb-1">Engagement Strategy</p>
                    <p className="text-white/80 text-sm">{strategy.engagementStrategy}</p>
                  </div>
                </div>
              </div>

              {/* Improvement Suggestions */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Lightbulb className="text-yellow-400" />
                  Improvement Suggestions
                </h3>
                
                <ul className="space-y-2">
                  {strategy.improvementSuggestions.map((suggestion, index) => (
                    <li key={index} className="text-sm text-white/80 flex items-start gap-2">
                      <span className="text-orange-400 mt-1">·</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Engagement Response Generator */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="text-cyan-400" />
            Engagement Response Generator
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Comment to Respond To
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Paste a comment here to generate an AI-powered response..."
                rows={3}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-500/50"
              />
            </div>
            
            <button
              onClick={handleGenerateResponse}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg font-medium transition-colors"
            >
              <Send size={16} />
              Generate Response
            </button>
            
            {engagementResponse && (
              <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                <p className="text-white">{engagementResponse}</p>
                <button
                  onClick={() => handleCopy(engagementResponse, "response")}
                  className="mt-3 flex items-center gap-1 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
                >
                  {copiedId === "response" ? <Check size={14} /> : <Copy size={14} />}
                  {copiedId === "response" ? "Copied!" : "Copy Response"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
