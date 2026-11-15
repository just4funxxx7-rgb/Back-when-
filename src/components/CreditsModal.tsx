import React from 'react';
import {
  UNIFIED_PROJECT_NAME,
  COMPANY_NAME,
  CREATOR_NAME,
} from '../lib/firebase';
import {
  X,
  Award,
  Building2,
  Shield,
  Download,
  Cloud,
  Smartphone,
} from 'lucide-react';

interface CreditsModalProps {
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-neutral-900 border border-amber-500/50 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl text-neutral-100">
        {/* Header */}
        <div className="px-5 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 block">
                {UNIFIED_PROJECT_NAME}
              </span>
              <h2 className="text-base font-extrabold text-white">
                Official Credits &amp; Ownership
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Single Consolidated Creator & Ownership Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-950/60 via-neutral-950 to-neutral-900 border border-amber-500/50 text-center space-y-3 shadow-inner">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-mono uppercase tracking-widest">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span>{COMPANY_NAME}</span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">
                Created By &amp; Co-Owned With
              </span>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {CREATOR_NAME}
              </h3>
            </div>

            <p className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
              <strong className="text-amber-300">{UNIFIED_PROJECT_NAME}</strong> is
              owned by <strong className="text-white">{COMPANY_NAME}</strong> and{' '}
              <strong className="text-white">{CREATOR_NAME}</strong>. Built with
              8K Supersampled Rendering, Articulated Ragdoll &amp; Structural
              Debris Physics, Dynamic Expanding Cartography, and Adaptive AI
              Companions.
            </p>
          </div>

          {/* APK & AWS Deployment Package Download Section */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Android APK &amp; AWS Cloud Package
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                AWS Ready · v2.7
              </span>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Download the packaged Android release APK (
              <code className="text-amber-300">
                com.newdawnindustries.aetheria
              </code>
              ) pre-configured with AWS Elastic Beanstalk, ECS, S3 + CloudFront,
              and Device Farm deployment manifests.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href="/api/export/apk"
                download="aetheria-outcast-lands-aws-release.apk"
                className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition"
              >
                <Download className="w-4 h-4" />
                <span>Download Android .APK</span>
              </a>
              <a
                href="/api/export/aws-config"
                download="aetheria-new-dawn-industries-aws-deploy.json"
                className="py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <Cloud className="w-4 h-4" />
                <span>AWS Deploy Manifest</span>
              </a>
            </div>
          </div>

          {/* Footer Ownership Notice */}
          <div className="p-3 rounded-xl bg-neutral-950/90 border border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>{UNIFIED_PROJECT_NAME}</span>
            </span>
            <span className="font-mono text-amber-300">
              © 2026 {COMPANY_NAME}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
