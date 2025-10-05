import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, PieChart, TrendingDown, Check } from "lucide-react";

interface OnboardingModalProps {
  open: boolean;
  onClose: () => void;
}

export const OnboardingModal = ({ open, onClose }: OnboardingModalProps) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: Upload,
      title: "Upload Your Bank Statement",
      description: "Export a CSV from your bank (HSBC, NatWest, Barclays) and upload it to get started. It's secure and private.",
    },
    {
      icon: PieChart,
      title: "See Your Spending Breakdown",
      description: "Casher automatically categorizes your transactions so you can see exactly where your money goes.",
    },
    {
      icon: TrendingDown,
      title: "Spot Hidden Subscriptions",
      description: "We'll detect recurring payments like Netflix, Spotify, or forgotten subscriptions you can cancel to save money.",
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Casher!</DialogTitle>
          <DialogDescription>
            Take control of your finances in 3 easy steps
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex justify-center items-center h-32">
            <div className="p-6 bg-primary/10 rounded-full">
              <Icon className="h-12 w-12 text-primary" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">{currentStep.title}</h3>
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          </div>

          <div className="flex justify-center gap-2">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 w-2 rounded-full transition-colors ${
                  idx === step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
                Back
              </Button>
            )}
            <Button
              onClick={() => {
                if (step < steps.length - 1) {
                  setStep(step + 1);
                } else {
                  onClose();
                }
              }}
              className="flex-1"
            >
              {step < steps.length - 1 ? "Next" : "Get Started"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
