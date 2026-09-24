/**
 * VANGUARD Phase 5: Smart Automation - Workflow Templates
 * 
 * قوالب جاهزة لسيناريوهات شائعة في Sales Ops
 * Ready-to-use workflow templates for common sales operations scenarios
 */

import { WorkflowDefinition } from '../workflow_engine';

// ============================================================================
// Lead Nurturing Workflow
// ============================================================================

export const leadNurturingWorkflow: WorkflowDefinition = {
  id: 'lead_nurturing_v1',
  name: 'Lead Nurturing Campaign',
  nameAr: 'حملة رعاية العملاء المحتملين',
  description: 'Automated lead nurturing with scoring, routing, and follow-ups',
  descriptionAr: 'رعاية تلقائية للعملاء مع التقييم والتوجيه والمتابعة',
  version: '1.0.0',
  initialStep: 'score_lead',
  
  variables: {
    leadId: '',
    leadName: '',
    leadEmail: '',
    leadPhone: '',
    initialScore: 0,
    source: '',
  },
  
  steps: [
    {
      id: 'score_lead',
      name: 'Score Lead',
      nameAr: 'تقييم العميل',
      type: 'action',
      action: {
        type: 'update_lead_score',
        params: {
          leadId: '{{leadId}}',
          score: '{{initialScore}}',
          reason: 'Initial scoring based on source',
        },
      },
    },
    {
      id: 'check_score',
      name: 'Check Lead Score',
      nameAr: 'فحص نقاط العميل',
      type: 'condition',
      condition: {
        expression: 'variables.initialScore >= 70',
        trueBranch: ['route_high_score', 'notify_agent_high'],
        falseBranch: ['wait_nurture', 'send_nurture_email'],
      },
    },
    {
      id: 'route_high_score',
      name: 'Route High-Score Lead',
      nameAr: 'توجيه العميل ذو النقاط العالية',
      type: 'action',
      action: {
        type: 'route_lead',
        params: {
          leadId: '{{leadId}}',
          priority: 'high',
          requiredSkills: ['sales', 'arabic'],
          autoAssign: true,
        },
      },
    },
    {
      id: 'notify_agent_high',
      name: 'Notify Agent',
      nameAr: 'إشعار الوكيل',
      type: 'action',
      action: {
        type: 'send_template_notification',
        params: {
          templateId: 'lead_assigned',
          recipient: '{{route_high_score_result.agentId}}',
          templateData: {
            leadName: '{{leadName}}',
            score: '{{initialScore}}',
          },
          priority: 'high',
        },
      },
      dependsOn: ['route_high_score'],
    },
    {
      id: 'wait_nurture',
      name: 'Wait Before Nurturing',
      nameAr: 'انتظار قبل الرعاية',
      type: 'action',
      action: {
        type: 'wait',
        params: {
          duration: 2,
          unit: 'hours',
        },
      },
    },
    {
      id: 'send_nurture_email',
      name: 'Send Nurture Email',
      nameAr: 'إرسال بريد رعاية',
      type: 'action',
      action: {
        type: 'send_email',
        params: {
          to: '{{leadEmail}}',
          subject: 'نحن هنا لمساعدتك',
          template: 'nurture_email_1',
          templateParams: {
            name: '{{leadName}}',
          },
        },
      },
      dependsOn: ['wait_nurture'],
    },
    {
      id: 'create_follow_up_task',
      name: 'Create Follow-up Task',
      nameAr: 'إنشاء مهمة متابعة',
      type: 'action',
      action: {
        type: 'create_task',
        params: {
          title: 'Follow up with {{leadName}}',
          description: 'Lead from {{source}} - Score: {{initialScore}}',
          priority: 'medium',
          relatedLeadId: '{{leadId}}',
          dueDate: '{{tomorrow}}',
        },
      },
    },
  ],
  
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Follow-up Automation Workflow
// ============================================================================

export const followUpWorkflow: WorkflowDefinition = {
  id: 'follow_up_automation_v1',
  name: 'Automated Follow-up',
  nameAr: 'متابعة تلقائية',
  description: 'Multi-channel follow-up sequence with escalation',
  descriptionAr: 'سلسلة متابعة متعددة القنوات مع التصعيد',
  version: '1.0.0',
  initialStep: 'wait_initial',
  
  variables: {
    leadId: '',
    leadName: '',
    leadPhone: '',
    leadEmail: '',
    agentId: '',
    attemptCount: 0,
  },
  
  steps: [
    {
      id: 'send_whatsapp_1',
      name: 'Send WhatsApp Message (Attempt 1)',
      nameAr: 'إرسال رسالة واتساب (محاولة 1)',
      type: 'action',
      action: {
        type: 'send_whatsapp',
        params: {
          to: '{{leadPhone}}',
          message: 'مرحباً {{leadName}}، نود متابعة استفسارك معنا. هل يمكننا مساعدتك؟',
        },
      },
    },
    {
      id: 'wait_response_1',
      name: 'Wait for Response',
      nameAr: 'انتظار الرد',
      type: 'action',
      action: {
        type: 'wait',
        params: {
          duration: 24,
          unit: 'hours',
        },
      },
    },
    {
      id: 'check_response_1',
      name: 'Check Response',
      nameAr: 'فحص الرد',
      type: 'condition',
      condition: {
        expression: 'variables.hasResponse === true',
        trueBranch: ['mark_engaged'],
        falseBranch: ['send_email_followup'],
      },
      dependsOn: ['wait_response_1'],
    },
    {
      id: 'mark_engaged',
      name: 'Mark as Engaged',
      nameAr: 'تمييز كمتفاعل',
      type: 'action',
      action: {
        type: 'update_lead',
        params: {
          leadId: '{{leadId}}',
          updates: {
            status: 'engaged',
            last_contact: '{{now}}',
          },
        },
      },
    },
    {
      id: 'send_email_followup',
      name: 'Send Email Follow-up',
      nameAr: 'إرسال بريد متابعة',
      type: 'action',
      action: {
        type: 'send_email',
        params: {
          to: '{{leadEmail}}',
          subject: 'متابعة - هل يمكننا مساعدتك؟',
          body: 'عزيزي {{leadName}}، نود متابعة استفسارك السابق معنا...',
        },
      },
    },
    {
      id: 'wait_response_2',
      name: 'Wait for Email Response',
      nameAr: 'انتظار رد البريد',
      type: 'action',
      action: {
        type: 'wait',
        params: {
          duration: 48,
          unit: 'hours',
        },
      },
      dependsOn: ['send_email_followup'],
    },
    {
      id: 'check_response_2',
      name: 'Check Email Response',
      nameAr: 'فحص رد البريد',
      type: 'condition',
      condition: {
        expression: 'variables.hasResponse === true',
        trueBranch: ['mark_engaged'],
        falseBranch: ['escalate_to_manager'],
      },
      dependsOn: ['wait_response_2'],
    },
    {
      id: 'escalate_to_manager',
      name: 'Escalate to Manager',
      nameAr: 'تصعيد للمدير',
      type: 'action',
      action: {
        type: 'create_task',
        params: {
          title: 'Manual follow-up needed: {{leadName}}',
          description: 'Lead not responding after 2 automated attempts',
          assignedTo: 'manager_id',
          priority: 'high',
          relatedLeadId: '{{leadId}}',
        },
      },
    },
    {
      id: 'notify_manager',
      name: 'Notify Manager',
      nameAr: 'إشعار المدير',
      type: 'action',
      action: {
        type: 'send_notification',
        params: {
          channel: 'push',
          recipient: 'manager_id',
          title: 'Lead Escalation',
          body: 'Lead {{leadName}} needs manual follow-up',
          priority: 'high',
        },
      },
      dependsOn: ['escalate_to_manager'],
    },
  ],
  
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Lead Qualification Workflow
// ============================================================================

export const leadQualificationWorkflow: WorkflowDefinition = {
  id: 'lead_qualification_v1',
  name: 'Lead Qualification',
  nameAr: 'تأهيل العملاء المحتملين',
  description: 'Automatic lead qualification based on engagement and data',
  descriptionAr: 'تأهيل تلقائي للعملاء بناءً على التفاعل والبيانات',
  version: '1.0.0',
  initialStep: 'check_score',
  
  variables: {
    leadId: '',
    leadScore: 0,
    engagementLevel: 0,
    dataCompleteness: 0,
  },
  
  steps: [
    {
      id: 'calculate_engagement',
      name: 'Calculate Engagement Score',
      nameAr: 'حساب نقاط التفاعل',
      type: 'action',
      action: {
        type: 'query_database',
        params: {
          table: 'vanguard_messages',
          operation: 'select',
          filters: {
            lead_id: '{{leadId}}',
            direction: 'inbound',
          },
          select: 'count(*)',
        },
      },
    },
    {
      id: 'check_data_completeness',
      name: 'Check Data Completeness',
      nameAr: 'فحص اكتمال البيانات',
      type: 'action',
      action: {
        type: 'query_database',
        params: {
          table: 'vanguard_leads',
          operation: 'select',
          filters: {
            id: '{{leadId}}',
          },
        },
      },
    },
    {
      id: 'calculate_qualification_score',
      name: 'Calculate Qualification Score',
      nameAr: 'حساب نقاط التأهيل',
      type: 'action',
      action: {
        type: 'transform_data',
        params: {
          input: 'leadData',
          transformations: [
            {
              type: 'reduce',
              params: {
                operation: 'sum',
                field: 'score',
                initial: 0,
              },
            },
          ],
        },
      },
      dependsOn: ['calculate_engagement', 'check_data_completeness'],
    },
    {
      id: 'update_qualification_score',
      name: 'Update Score',
      nameAr: 'تحديث النقاط',
      type: 'action',
      action: {
        type: 'update_lead_score',
        params: {
          leadId: '{{leadId}}',
          score: '{{calculate_qualification_score_result}}',
          reason: 'Qualification workflow',
        },
      },
      dependsOn: ['calculate_qualification_score'],
    },
    {
      id: 'check_qualification',
      name: 'Check if Qualified',
      nameAr: 'فحص التأهيل',
      type: 'condition',
      condition: {
        expression: 'variables.leadScore >= 80',
        trueBranch: ['mark_qualified', 'route_to_sales', 'notify_qualified'],
        falseBranch: ['continue_nurturing'],
      },
      dependsOn: ['update_qualification_score'],
    },
    {
      id: 'mark_qualified',
      name: 'Mark as Qualified',
      nameAr: 'تمييز كمؤهل',
      type: 'action',
      action: {
        type: 'update_lead',
        params: {
          leadId: '{{leadId}}',
          updates: {
            status: 'qualified',
            qualified_at: '{{now}}',
          },
        },
      },
    },
    {
      id: 'route_to_sales',
      name: 'Route to Sales Team',
      nameAr: 'توجيه لفريق المبيعات',
      type: 'action',
      action: {
        type: 'route_lead',
        params: {
          leadId: '{{leadId}}',
          priority: 'high',
          requiredSkills: ['sales', 'closing'],
          autoAssign: true,
        },
      },
      dependsOn: ['mark_qualified'],
    },
    {
      id: 'notify_qualified',
      name: 'Notify Sales Agent',
      nameAr: 'إشعار وكيل المبيعات',
      type: 'action',
      action: {
        type: 'send_template_notification',
        params: {
          templateId: 'lead_qualified',
          recipient: '{{route_to_sales_result.agentId}}',
          templateData: {
            leadName: '{{leadName}}',
          },
          priority: 'high',
        },
      },
      dependsOn: ['route_to_sales'],
    },
    {
      id: 'continue_nurturing',
      name: 'Continue Nurturing',
      nameAr: 'مواصلة الرعاية',
      type: 'action',
      action: {
        type: 'create_task',
        params: {
          title: 'Continue nurturing: {{leadName}}',
          description: 'Lead needs more engagement (Score: {{leadScore}})',
          priority: 'medium',
          relatedLeadId: '{{leadId}}',
          dueDate: '{{in_3_days}}',
        },
      },
    },
  ],
  
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Onboarding Workflow
// ============================================================================

export const customerOnboardingWorkflow: WorkflowDefinition = {
  id: 'customer_onboarding_v1',
  name: 'Customer Onboarding',
  nameAr: 'إعداد العميل الجديد',
  description: 'Automated customer onboarding with welcome sequence',
  descriptionAr: 'إعداد تلقائي للعميل مع سلسلة ترحيب',
  version: '1.0.0',
  initialStep: 'send_welcome',
  
  variables: {
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    planType: 'basic',
  },
  
  steps: [
    {
      id: 'send_welcome_email',
      name: 'Send Welcome Email',
      nameAr: 'إرسال بريد ترحيبي',
      type: 'action',
      action: {
        type: 'send_email',
        params: {
          to: '{{customerEmail}}',
          subject: 'مرحباً بك في منصتنا!',
          template: 'welcome_email',
          templateParams: {
            name: '{{customerName}}',
            plan: '{{planType}}',
          },
        },
      },
    },
    {
      id: 'send_welcome_whatsapp',
      name: 'Send Welcome WhatsApp',
      nameAr: 'إرسال رسالة واتساب ترحيبية',
      type: 'action',
      action: {
        type: 'send_whatsapp',
        params: {
          to: '{{customerPhone}}',
          message: 'مرحباً {{customerName}}! نحن سعداء بانضمامك 🎉',
        },
      },
    },
    {
      id: 'assign_account_manager',
      name: 'Assign Account Manager',
      nameAr: 'تعيين مدير حساب',
      type: 'action',
      action: {
        type: 'find_best_agent',
        params: {
          requiredSkills: ['account_management', 'onboarding'],
          minCapacity: 1,
        },
      },
    },
    {
      id: 'create_onboarding_task',
      name: 'Create Onboarding Task',
      nameAr: 'إنشاء مهمة إعداد',
      type: 'action',
      action: {
        type: 'create_task',
        params: {
          title: 'Onboard new customer: {{customerName}}',
          description: 'Complete onboarding process for {{planType}} plan',
          assignedTo: '{{assign_account_manager_result.agentId}}',
          priority: 'high',
          dueDate: '{{in_2_days}}',
        },
      },
      dependsOn: ['assign_account_manager'],
    },
    {
      id: 'notify_account_manager',
      name: 'Notify Account Manager',
      nameAr: 'إشعار مدير الحساب',
      type: 'action',
      action: {
        type: 'send_notification',
        params: {
          channel: 'push',
          recipient: '{{assign_account_manager_result.agentId}}',
          title: 'عميل جديد',
          body: 'تم تعيينك لإعداد العميل {{customerName}}',
          priority: 'high',
        },
      },
      dependsOn: ['create_onboarding_task'],
    },
    {
      id: 'schedule_day_1_tips',
      name: 'Schedule Day 1 Tips',
      nameAr: 'جدولة نصائح اليوم الأول',
      type: 'action',
      action: {
        type: 'send_notification',
        params: {
          channel: 'email',
          recipient: '{{customerEmail}}',
          title: 'نصائح للبداية',
          body: 'إليك بعض النصائح لتحقيق أقصى استفادة...',
          scheduledFor: '{{in_24_hours}}',
        },
      },
    },
    {
      id: 'schedule_day_3_checkup',
      name: 'Schedule Day 3 Check-up',
      nameAr: 'جدولة متابعة اليوم الثالث',
      type: 'action',
      action: {
        type: 'create_task',
        params: {
          title: 'Day 3 check-up: {{customerName}}',
          description: 'Check customer progress and answer questions',
          assignedTo: '{{assign_account_manager_result.agentId}}',
          priority: 'medium',
          dueDate: '{{in_3_days}}',
        },
      },
      dependsOn: ['assign_account_manager'],
    },
    {
      id: 'schedule_week_1_survey',
      name: 'Schedule Week 1 Survey',
      nameAr: 'جدولة استبيان الأسبوع الأول',
      type: 'action',
      action: {
        type: 'send_email',
        params: {
          to: '{{customerEmail}}',
          subject: 'كيف كانت تجربتك؟',
          template: 'week_1_survey',
          scheduledFor: '{{in_7_days}}',
        },
      },
    },
  ],
  
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Task Escalation Workflow
// ============================================================================

export const taskEscalationWorkflow: WorkflowDefinition = {
  id: 'task_escalation_v1',
  name: 'Task Escalation',
  nameAr: 'تصعيد المهام',
  description: 'Automatic task escalation for overdue tasks',
  descriptionAr: 'تصعيد تلقائي للمهام المتأخرة',
  version: '1.0.0',
  initialStep: 'check_overdue',
  
  variables: {
    taskId: '',
    taskTitle: '',
    assignedTo: '',
    dueDate: '',
    priority: 'medium',
  },
  
  steps: [
    {
      id: 'check_overdue',
      name: 'Check if Overdue',
      nameAr: 'فحص التأخير',
      type: 'condition',
      condition: {
        expression: 'variables.dueDate < Date.now()',
        trueBranch: ['send_reminder', 'wait_response', 'escalate_if_no_action'],
        falseBranch: [],
      },
    },
    {
      id: 'send_reminder',
      name: 'Send Reminder',
      nameAr: 'إرسال تذكير',
      type: 'action',
      action: {
        type: 'send_notification',
        params: {
          channel: 'push',
          recipient: '{{assignedTo}}',
          title: 'مهمة متأخرة',
          body: 'المهمة "{{taskTitle}}" متأخرة. يرجى المتابعة',
          priority: 'high',
          data: {
            taskId: '{{taskId}}',
          },
        },
      },
    },
    {
      id: 'wait_response',
      name: 'Wait for Action',
      nameAr: 'انتظار اتخاذ إجراء',
      type: 'action',
      action: {
        type: 'wait',
        params: {
          duration: 4,
          unit: 'hours',
        },
      },
      dependsOn: ['send_reminder'],
    },
    {
      id: 'escalate_if_no_action',
      name: 'Escalate to Manager',
      nameAr: 'تصعيد للمدير',
      type: 'condition',
      condition: {
        expression: 'variables.taskCompleted !== true',
        trueBranch: ['reassign_task', 'notify_manager', 'notify_original_assignee'],
        falseBranch: [],
      },
      dependsOn: ['wait_response'],
    },
    {
      id: 'reassign_task',
      name: 'Reassign Task',
      nameAr: 'إعادة تعيين المهمة',
      type: 'action',
      action: {
        type: 'assign_task',
        params: {
          taskId: '{{taskId}}',
          assignedTo: 'manager_id',
        },
      },
    },
    {
      id: 'notify_manager',
      name: 'Notify Manager',
      nameAr: 'إشعار المدير',
      type: 'action',
      action: {
        type: 'send_notification',
        params: {
          channel: 'push',
          recipient: 'manager_id',
          title: 'مهمة متأخرة تحتاج تدخل',
          body: 'المهمة "{{taskTitle}}" تم تصعيدها من {{assignedTo}}',
          priority: 'urgent',
          data: {
            taskId: '{{taskId}}',
            originalAssignee: '{{assignedTo}}',
          },
        },
      },
      dependsOn: ['reassign_task'],
    },
    {
      id: 'notify_original_assignee',
      name: 'Notify Original Assignee',
      nameAr: 'إشعار المكلف الأصلي',
      type: 'action',
      action: {
        type: 'send_notification',
        params: {
          channel: 'email',
          recipient: '{{assignedTo}}',
          title: 'تم تصعيد المهمة',
          body: 'تم تصعيد المهمة "{{taskTitle}}" للمدير بسبب التأخير',
          priority: 'high',
        },
      },
      dependsOn: ['reassign_task'],
    },
  ],
  
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ============================================================================
// Template Registry
// ============================================================================

export const workflowTemplates: Record<string, WorkflowDefinition> = {
  lead_nurturing: leadNurturingWorkflow,
  follow_up_automation: followUpWorkflow,
  lead_qualification: leadQualificationWorkflow,
  customer_onboarding: customerOnboardingWorkflow,
  task_escalation: taskEscalationWorkflow,
};

/**
 * Get workflow template by ID
 */
export function getWorkflowTemplate(templateId: string): WorkflowDefinition | undefined {
  return workflowTemplates[templateId];
}

/**
 * Get all workflow templates
 */
export function getAllWorkflowTemplates(): WorkflowDefinition[] {
  return Object.values(workflowTemplates);
}

/**
 * Create workflow instance from template
 */
export function createFromTemplate(
  templateId: string,
  variables: Record<string, any>
): WorkflowDefinition {
  const template = getWorkflowTemplate(templateId);
  if (!template) {
    throw new Error(`Workflow template not found: ${templateId}`);
  }

  // Create new workflow instance with custom variables
  return {
    ...template,
    id: `${template.id}_instance_${Date.now()}`,
    variables: {
      ...template.variables,
      ...variables,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
