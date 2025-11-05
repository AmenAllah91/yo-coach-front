import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NutritionPlan } from './nutrition.service';

export interface NutritionState {
  plans: NutritionPlan[];
  loading: boolean;
  error: string | null;
  selectedPlan: NutritionPlan | null;
}

@Injectable({
  providedIn: 'root'
})
export class NutritionBlocService {
  private initialState: NutritionState = {
    plans: [],
    loading: false,
    error: null,
    selectedPlan: null
  };

  private stateSubject = new BehaviorSubject<NutritionState>(this.initialState);
  public state$ = this.stateSubject.asObservable();

  constructor() {}

  get currentState(): NutritionState {
    return this.stateSubject.value;
  }

  // Actions
  setLoading(loading: boolean) {
    this.updateState({ loading });
  }

  setPlans(plans: NutritionPlan[]) {
    this.updateState({ plans, loading: false, error: null });
  }

  addPlan(plan: NutritionPlan) {
    const currentPlans = this.currentState.plans;
    this.updateState({ plans: [...currentPlans, plan] });
  }

  updatePlan(updatedPlan: NutritionPlan) {
    const currentPlans = this.currentState.plans;
    const updatedPlans = currentPlans.map(plan => 
      plan.id === updatedPlan.id ? updatedPlan : plan
    );
    this.updateState({ plans: updatedPlans });
  }

  removePlan(planId: string) {
    const currentPlans = this.currentState.plans;
    const filteredPlans = currentPlans.filter(plan => plan.id !== planId);
    this.updateState({ plans: filteredPlans });
  }

  setSelectedPlan(plan: NutritionPlan | null) {
    this.updateState({ selectedPlan: plan });
  }

  setError(error: string | null) {
    this.updateState({ error, loading: false });
  }

  clearError() {
    this.updateState({ error: null });
  }

  reset() {
    this.stateSubject.next(this.initialState);
  }

  private updateState(partialState: Partial<NutritionState>) {
    const currentState = this.currentState;
    const newState = { ...currentState, ...partialState };
    this.stateSubject.next(newState);
  }
}