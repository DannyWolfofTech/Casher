import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Progress } from "./ui/progress";
import { Plus, Target, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

interface SavingsGoal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
}

export default function SavingsGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    const { data, error } = await supabase
      .from("savings_goals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching goals:", error);
    } else {
      setGoals(data || []);
    }
  };

  const createGoal = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from("savings_goals").insert({
      user_id: session.user.id,
      title,
      target_amount: parseFloat(targetAmount),
      deadline: deadline || null,
    });

    if (error) {
      toast({
        title: t("error"),
        description: t("failedToCreateGoal"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("success"),
        description: t("goalCreated"),
      });
      setOpen(false);
      setTitle("");
      setTargetAmount("");
      setDeadline("");
      fetchGoals();
    }
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase.from("savings_goals").delete().eq("id", id);

    if (error) {
      toast({
        title: t("error"),
        description: t("failedToDeleteGoal"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("success"),
        description: t("goalDeleted"),
      });
      fetchGoals();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t("savingsGoals")}
            </CardTitle>
            <CardDescription>{t("trackFinancialGoals")}</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("addGoal")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("createGoal")}</DialogTitle>
                <DialogDescription>{t("setFinancialTarget")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">{t("goalTitle")}</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t("goalTitlePlaceholder")}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">{t("targetAmount")}</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="1000"
                  />
                </div>
                <div>
                  <Label htmlFor="deadline">{t("deadlineOptional")}</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
                <Button onClick={createGoal} className="w-full">
                  {t("createGoal")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {t("noGoalsYet")}
          </p>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const progress = (goal.current_amount / goal.target_amount) * 100;
              return (
                <div key={goal.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold">{goal.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        £{goal.current_amount.toFixed(2)} / £{goal.target_amount.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteGoal(goal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Progress value={progress} className="mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {progress.toFixed(0)}% {t("complete")}
                    {goal.deadline && ` • ${t("due")}: ${new Date(goal.deadline).toLocaleDateString()}`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
