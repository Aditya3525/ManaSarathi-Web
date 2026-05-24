import React, { useState } from 'react';
import { Check, Sparkles, Shield, Zap, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { useNotificationStore } from '../../../stores/notificationStore';

interface PlanFeature {
  name: string;
  included: boolean;
}

interface PlanProps {
  name: string;
  description: string;
  price: string;
  interval: string;
  features: PlanFeature[];
  isPopular?: boolean;
  currentPlan?: boolean;
  onUpgrade?: () => void;
  buttonText: string;
}

export const SubscriptionPlans: React.FC<{ userIsPremium?: boolean }> = ({ userIsPremium }) => {
  const { push } = useNotificationStore();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [currentPlan, setCurrentPlan] = useState<'free' | 'premium'>(userIsPremium ? 'premium' : 'free');

  React.useEffect(() => {
    setCurrentPlan(userIsPremium ? 'premium' : 'free');
  }, [userIsPremium]);

  const handleUpgrade = () => {
    // In a real app, this would redirect to a Stripe checkout session
    push({
      type: 'success',
      title: 'Redirecting to Checkout',
      description: 'You are being redirected to our secure payment portal.',
    });
    
    // Simulate successful upgrade after a short delay for demo purposes
    setTimeout(() => {
      setCurrentPlan('premium');
      push({
        type: 'success',
        title: 'Upgrade Successful!',
        description: 'Welcome to MaanSarathi Premium. All features are now unlocked.',
      });
    }, 2000);
  };

  const freeFeatures: PlanFeature[] = [
    { name: 'Basic Mood & Sleep Tracking', included: true },
    { name: 'Journaling & Gratitude Logs', included: true },
    { name: 'Emergency Crisis Resources', included: true },
    { name: 'Standard Clinical Assessments', included: true },
    { name: 'Limited AI Companion Chat (5/day)', included: true },
    { name: 'Unlimited AI Therapy', included: false },
    { name: 'Advanced Trend Analytics', included: false },
    { name: 'Premium Audio Meditations', included: false },
    { name: 'Interactive Therapeutic Games', included: false },
  ];

  const premiumFeatures: PlanFeature[] = [
    { name: 'Basic Mood & Sleep Tracking', included: true },
    { name: 'Journaling & Gratitude Logs', included: true },
    { name: 'Emergency Crisis Resources', included: true },
    { name: 'Standard Clinical Assessments', included: true },
    { name: 'Limited AI Companion Chat (5/day)', included: true },
    { name: 'Unlimited AI Therapy', included: true },
    { name: 'Advanced Trend Analytics', included: true },
    { name: 'Premium Audio Meditations', included: true },
    { name: 'Interactive Therapeutic Games', included: true },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center max-w-3xl mx-auto mb-12">
        <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 mb-4">
          Invest in Your Mental Wellbeing
        </h2>
        <p className="text-lg text-muted-foreground">
          Choose the plan that fits your journey. Upgrade anytime to unlock the full power of your AI therapy companion.
        </p>
        
        {/* Billing Toggle */}
        <div className="mt-8 flex justify-center items-center space-x-3">
          <span className={`text-sm ${billingCycle === 'monthly' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-primary transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            role="switch"
            aria-checked={billingCycle === 'yearly'}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                billingCycle === 'yearly' ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-sm ${billingCycle === 'yearly' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            Yearly <Badge variant="secondary" className="ml-1 bg-green-100 text-green-800 hover:bg-green-100">Save 20%</Badge>
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
        {/* Free Plan */}
        <Card className={`relative overflow-hidden flex flex-col transition-all duration-300 ${currentPlan === 'free' ? 'border-primary shadow-md' : 'border-border/50 hover:border-border'}`}>
          {currentPlan === 'free' && (
            <div className="absolute top-0 right-0 p-3">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                Current Plan
              </Badge>
            </div>
          )}
          <CardHeader className="pb-8 pt-8 px-8">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-slate-500" /> Essential
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Everything you need to build a healthy baseline for your mental health.
            </CardDescription>
            <div className="mt-6 flex items-baseline text-5xl font-extrabold">
              $0
              <span className="ml-1 text-xl font-medium text-muted-foreground">/mo</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 px-8">
            <ul className="space-y-4">
              {freeFeatures.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0 mt-0.5">
                    {feature.included ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <X className="h-5 w-5 text-slate-300" />
                    )}
                  </div>
                  <p className={`ml-3 text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                    {feature.name}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="px-8 pb-8 pt-4">
            <Button 
              variant={currentPlan === 'free' ? "outline" : "default"} 
              className="w-full h-12 text-base font-medium"
              disabled={currentPlan === 'free'}
            >
              {currentPlan === 'free' ? 'Your Current Plan' : 'Downgrade to Free'}
            </Button>
          </CardFooter>
        </Card>

        {/* Premium Plan */}
        <Card className={`relative overflow-hidden flex flex-col transform transition-all duration-300 hover:-translate-y-1 ${currentPlan === 'premium' ? 'border-primary shadow-xl ring-2 ring-primary ring-opacity-50' : 'border-purple-200 shadow-lg'}`}>
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-purple-600"></div>
          
          {currentPlan === 'premium' ? (
             <div className="absolute top-0 right-0 p-4 pt-5">
             <Badge className="bg-gradient-to-r from-primary to-purple-600 text-white border-none">
               Current Plan
             </Badge>
           </div>
          ) : (
            <div className="absolute top-0 right-0 p-4 pt-5">
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none">
                Most Popular
              </Badge>
            </div>
          )}
          
          <CardHeader className="pb-8 pt-8 px-8">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-500" /> Premium
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Complete access to AI therapy, analytics, and interactive healing.
            </CardDescription>
            <div className="mt-6 flex items-baseline text-5xl font-extrabold">
              ${billingCycle === 'yearly' ? '7.99' : '9.99'}
              <span className="ml-1 text-xl font-medium text-muted-foreground">/mo</span>
            </div>
            {billingCycle === 'yearly' && (
              <p className="text-sm text-muted-foreground mt-1">Billed $95.88 annually</p>
            )}
          </CardHeader>
          <CardContent className="flex-1 px-8">
            <ul className="space-y-4">
              {premiumFeatures.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <div className="flex-shrink-0 mt-0.5">
                    <Check className="h-5 w-5 text-purple-500" />
                  </div>
                  <p className="ml-3 text-sm text-foreground font-medium">
                    {feature.name}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="px-8 pb-8 pt-4">
            <Button 
              className={`w-full h-12 text-base font-medium ${currentPlan === 'premium' ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white shadow-md'}`}
              onClick={handleUpgrade}
              disabled={currentPlan === 'premium'}
            >
              {currentPlan === 'premium' ? 'You are Premium!' : (
                <>
                  <Zap className="mr-2 h-4 w-4" /> Upgrade Now
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Trust / FAQ snippet */}
      <div className="mt-16 text-center">
        <p className="text-muted-foreground text-sm">
          Secure payment via Stripe. Cancel anytime. <br className="sm:hidden" />
          Need a financial hardship discount?{' '}
          <button
            type="button"
            onClick={() =>
              push({
                type: 'info',
                title: 'Financial Hardship Discount',
                description: 'Hardship discounts are handled via support. Please open a support ticket under the Help & Safety tab.',
              })
            }
            className="text-primary hover:underline cursor-pointer bg-transparent border-none p-0 inline font-medium"
          >
            Contact us
          </button>
          .
        </p>
      </div>
    </div>
  );
};
