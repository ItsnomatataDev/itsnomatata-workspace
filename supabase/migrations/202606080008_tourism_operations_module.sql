insert into public.organization_features (
  organization_id,
  feature_key,
  module_label,
  module_category,
  enabled,
  limits,
  configuration,
  permissions
)
select
  o.id,
  'tourism_operations',
  'Tourism Operations',
  'Tourism',
  case
    when o.slug = 'its-nomatata' or coalesce(o.is_system_organization, false) then false
    else true
  end,
  '{}'::jsonb,
  jsonb_build_object(
    'routes',
    jsonb_build_array(
      '/tourism',
      '/tourism/bookings',
      '/tourism/itineraries',
      '/tourism/guests',
      '/tourism/transfers'
    )
  ),
  '{}'::jsonb
from public.organizations o
on conflict (organization_id, feature_key) do update
set
  module_label = excluded.module_label,
  module_category = excluded.module_category,
  configuration = public.organization_features.configuration || excluded.configuration,
  updated_at = now();

insert into public.organization_roles (
  organization_id,
  role_key,
  role_label,
  description,
  department,
  is_admin_role,
  is_manager_role,
  is_default_signup_role,
  requires_approval,
  is_active,
  permissions,
  onboarding_config,
  department_access
)
select
  o.id,
  role.role_key,
  role.role_label,
  role.description,
  'tourism',
  false,
  role.is_manager_role,
  false,
  true,
  true,
  role.permissions,
  '{}'::jsonb,
  '{}'::jsonb
from public.organizations o
cross join (
  values
    (
      'tourism_operations_manager',
      'Tourism Operations Manager',
      'Coordinates guest movements, bookings, itineraries, activity schedules, transfers and service incidents.',
      true,
      '{"tourism_operations":true,"bookings":true,"guests":true,"itineraries":true,"transfers":true,"fleet":true,"reports":true,"broadcast_team":true}'::jsonb
    ),
    (
      'reservations_agent',
      'Reservations Agent',
      'Manages bookings, guest details, confirmations and itinerary preparation.',
      false,
      '{"tourism_operations":true,"bookings":true,"guests":true,"itineraries":true}'::jsonb
    ),
    (
      'guest_relations',
      'Guest Relations',
      'Handles arrivals, special requests, guest notes, escalations and service quality follow-up.',
      false,
      '{"tourism_operations":true,"guests":true,"itineraries":true,"incidents":true}'::jsonb
    ),
    (
      'tour_guide',
      'Tour Guide',
      'Views assigned activities, itinerary details, guest lists and operational notes.',
      false,
      '{"assigned_tours":true,"itineraries":true,"incidents":true,"time_tracking":true}'::jsonb
    ),
    (
      'driver',
      'Driver',
      'Views assigned transfers, pickup windows, routing notes and vehicle allocation.',
      false,
      '{"assigned_transfers":true,"fleet_assigned":true,"incidents":true,"time_tracking":true}'::jsonb
    ),
    (
      'activity_coordinator',
      'Activity Coordinator',
      'Coordinates activities, guide allocation, capacity and daily schedule readiness.',
      true,
      '{"tourism_operations":true,"activities":true,"itineraries":true,"schedule_team":true}'::jsonb
    ),
    (
      'fleet_coordinator',
      'Fleet Coordinator',
      'Coordinates tourism transfers, vehicles, driver allocation, fuel and service readiness.',
      true,
      '{"tourism_operations":true,"transfers":true,"fleet":true,"drivers":true}'::jsonb
    )
) as role(role_key, role_label, description, is_manager_role, permissions)
on conflict (organization_id, role_key) do update
set
  role_label = excluded.role_label,
  description = excluded.description,
  department = excluded.department,
  is_manager_role = excluded.is_manager_role,
  permissions = public.organization_roles.permissions || excluded.permissions,
  updated_at = now();
