
-- =====================================================================
-- Demo company seed: Summit Civil & Earthworks Pty Ltd
-- Identifier: companies.abn = 'DEMO-SUMMIT'
-- Idempotent: drops any prior demo company and rebuilds in one call.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.seed_demo_company(_admin_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_old_company_id uuid;
  v_admin_email text;
  v_op_ids uuid[] := ARRAY[]::uuid[];
  v_asset_ids uuid[] := ARRAY[]::uuid[];
  v_op_names text[] := ARRAY[
    'Jack Wilson','Sarah McKenzie','Liam O''Brien','Olivia Thompson','Noah Patel',
    'Charlotte Nguyen','William Davies','Amelia Robertson','James Murphy','Isla Chen',
    'Lucas Walker','Mia Anderson','Henry Roberts','Ava Mitchell','Ethan Campbell',
    'Grace Sullivan','Mason Clarke','Zoe Harrison','Cooper Bennett','Ruby Hayes',
    'Oliver Stewart','Ella Foster','Hudson Reid','Chloe Edwards','Jaxon Brooks',
    'Lily Cooper','Tyler Morgan','Sienna Hughes','Riley Jackson','Hayden Marshall'
  ];
  v_asset_specs jsonb := '[
    {"name":"EX-01 CAT 320","make":"Caterpillar","model":"320","type":"excavator","year":2021},
    {"name":"EX-02 CAT 320","make":"Caterpillar","model":"320","type":"excavator","year":2020},
    {"name":"EX-03 CAT 336","make":"Caterpillar","model":"336","type":"excavator","year":2022},
    {"name":"EX-04 CAT 336","make":"Caterpillar","model":"336","type":"excavator","year":2019},
    {"name":"EX-05 Komatsu PC138","make":"Komatsu","model":"PC138","type":"excavator","year":2021},
    {"name":"EX-06 Komatsu PC138","make":"Komatsu","model":"PC138","type":"excavator","year":2020},
    {"name":"EX-07 Komatsu PC200","make":"Komatsu","model":"PC200","type":"excavator","year":2022},
    {"name":"EX-08 Komatsu PC200","make":"Komatsu","model":"PC200","type":"excavator","year":2018},
    {"name":"EX-09 Hitachi ZX200","make":"Hitachi","model":"ZX200","type":"excavator","year":2021},
    {"name":"EX-10 Hitachi ZX200","make":"Hitachi","model":"ZX200","type":"excavator","year":2020},
    {"name":"EX-11 Hitachi ZX135","make":"Hitachi","model":"ZX135","type":"excavator","year":2019},
    {"name":"EX-12 CAT 320","make":"Caterpillar","model":"320","type":"excavator","year":2023},
    {"name":"LD-01 Volvo L90","make":"Volvo","model":"L90","type":"loader","year":2022},
    {"name":"LD-02 Volvo L90","make":"Volvo","model":"L90","type":"loader","year":2021},
    {"name":"LD-03 CAT 950","make":"Caterpillar","model":"950","type":"loader","year":2020},
    {"name":"LD-04 Komatsu WA320","make":"Komatsu","model":"WA320","type":"loader","year":2021},
    {"name":"DT-01 Volvo A40G","make":"Volvo","model":"A40G","type":"dump_truck","year":2022},
    {"name":"DT-02 Volvo A40G","make":"Volvo","model":"A40G","type":"dump_truck","year":2021},
    {"name":"DT-03 CAT 740","make":"Caterpillar","model":"740","type":"dump_truck","year":2020},
    {"name":"DZ-01 CAT D6","make":"Caterpillar","model":"D6","type":"dozer","year":2021},
    {"name":"DZ-02 CAT D6","make":"Caterpillar","model":"D6","type":"dozer","year":2019},
    {"name":"DZ-03 CAT D8","make":"Caterpillar","model":"D8","type":"dozer","year":2020},
    {"name":"DZ-04 Komatsu D65","make":"Komatsu","model":"D65","type":"dozer","year":2022},
    {"name":"SS-01 Bobcat T770","make":"Bobcat","model":"T770","type":"skid_steer","year":2022},
    {"name":"SS-02 Bobcat T770","make":"Bobcat","model":"T770","type":"skid_steer","year":2021},
    {"name":"SS-03 Bobcat S650","make":"Bobcat","model":"S650","type":"skid_steer","year":2020},
    {"name":"SS-04 Bobcat S650","make":"Bobcat","model":"S650","type":"skid_steer","year":2023},
    {"name":"BH-01 JCB 3CX","make":"JCB","model":"3CX","type":"machinery","year":2021},
    {"name":"BH-02 JCB 3CX","make":"JCB","model":"3CX","type":"machinery","year":2020},
    {"name":"GR-01 CAT 140M Grader","make":"Caterpillar","model":"140M","type":"grader","year":2021},
    {"name":"GR-02 Komatsu GD655","make":"Komatsu","model":"GD655","type":"grader","year":2019},
    {"name":"RL-01 CAT CS56 Roller","make":"Caterpillar","model":"CS56","type":"roller","year":2021},
    {"name":"RL-02 Bomag BW213","make":"Bomag","model":"BW213","type":"roller","year":2020},
    {"name":"WC-01 Water Cart","make":"Isuzu","model":"FYH","type":"water_cart","year":2019},
    {"name":"WC-02 Water Cart","make":"Volvo","model":"FMX","type":"water_cart","year":2021},
    {"name":"TR-01 Kenworth T610","make":"Kenworth","model":"T610","type":"prime_mover","year":2022},
    {"name":"TR-02 Kenworth T610","make":"Kenworth","model":"T610","type":"prime_mover","year":2021},
    {"name":"TR-03 Hino 500","make":"Hino","model":"500 Series","type":"truck","year":2020},
    {"name":"TR-04 Hino 500","make":"Hino","model":"500 Series","type":"truck","year":2022},
    {"name":"TR-05 Isuzu Service","make":"Isuzu","model":"NPR","type":"truck","year":2021},
    {"name":"TR-06 Isuzu FRR","make":"Isuzu","model":"FRR","type":"truck","year":2020},
    {"name":"UT-01 Hilux Site Ute","make":"Toyota","model":"Hilux","type":"ute","year":2022},
    {"name":"UT-02 Ranger Site Ute","make":"Ford","model":"Ranger","type":"ute","year":2023},
    {"name":"UT-03 Hilux Site Ute","make":"Toyota","model":"Hilux","type":"ute","year":2021},
    {"name":"GN-01 Generator 60kVA","make":"Cummins","model":"C60D5","type":"generator","year":2020}
  ]'::jsonb;
  v_locations text[] := ARRAY['Bayswater Yard','Truganina Depot','Werribee Site','Geelong Site','Pakenham Site','Sunshine Yard','Dandenong Site'];
  v_defect_descs text[] := ARRAY[
    'Hydraulic leak from boom cylinder','Reverse beacon not working','Seatbelt webbing frayed',
    'Front left tyre worn below limit','Engine oil leak at filter housing','Driver side mirror cracked',
    'Fire extinguisher service tag expired','Battery slow to crank','Coolant level low at start',
    'Loose handrail on left side access','Air-con not blowing cold','Cracked windscreen lower corner',
    'Hydraulic hose chafing on chassis','Reverse alarm intermittent','Park brake holding poorly on slope',
    'Bucket pin showing wear','Fuel cap seal damaged','Tracked pad bolt missing',
    'GET tooth missing','Cab light flickering','Wiper blade torn',
    'Grease nipple sheared','Exhaust mounting bracket cracked','Worklight lens broken','Engine bay heat shield loose'
  ];
  v_severities text[] := ARRAY['low','low','medium','medium','medium','high','high','critical'];
  v_statuses text[] := ARRAY['open','open','in_progress','in_progress','resolved','resolved','resolved'];
  i int;
  v_asset_id uuid;
  v_op_id uuid;
  v_spec jsonb;
  v_meter numeric;
  v_pass boolean;
  v_day int;
  v_count int;
  v_op_pick uuid;
  v_now timestamptz := now();
BEGIN
  IF _admin_user_id IS NULL THEN
    RAISE EXCEPTION 'admin user id required';
  END IF;

  -- 1. Wipe any prior demo company (cascade clears assets, operators, prestarts, defects, etc.)
  SELECT id INTO v_old_company_id FROM public.companies WHERE abn = 'DEMO-SUMMIT' LIMIT 1;
  IF v_old_company_id IS NOT NULL THEN
    DELETE FROM public.subscriptions WHERE company_id = v_old_company_id;
    DELETE FROM public.user_roles WHERE company_id = v_old_company_id;
    DELETE FROM public.companies WHERE id = v_old_company_id;
  END IF;

  -- 2. Create company
  INSERT INTO public.companies (name, abn, created_by)
  VALUES ('Summit Civil & Earthworks Pty Ltd', 'DEMO-SUMMIT', _admin_user_id)
  RETURNING id INTO v_company_id;

  -- 3. Link admin
  SELECT email INTO v_admin_email FROM auth.users WHERE id = _admin_user_id;
  INSERT INTO public.profiles (id, email, full_name, company_id)
  VALUES (_admin_user_id, v_admin_email, 'Demo Admin', v_company_id)
  ON CONFLICT (id) DO UPDATE
    SET company_id = EXCLUDED.company_id,
        email = COALESCE(public.profiles.email, EXCLUDED.email),
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        updated_at = now();

  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (_admin_user_id, v_company_id, 'admin')
  ON CONFLICT DO NOTHING;

  -- 4. Seed prestart template (uses existing helper)
  PERFORM public.seed_prestart_template(v_company_id);

  -- 5. Create 30 operators
  FOR i IN 1..array_length(v_op_names, 1) LOOP
    INSERT INTO public.operators (company_id, full_name, email, phone, position, depot, status, employee_id)
    VALUES (
      v_company_id,
      v_op_names[i],
      'demo+' || lower(replace(replace(v_op_names[i], ' ', '.'), '''', '')) || '@summitcivil.example',
      '04' || lpad((10000000 + i * 137 % 89999999)::text, 8, '0'),
      CASE WHEN i <= 6 THEN 'Supervisor' WHEN i <= 7 THEN 'Fleet Manager' ELSE 'Operator' END,
      v_locations[1 + (i % array_length(v_locations,1))],
      'active',
      'EMP-' || lpad(i::text, 4, '0')
    )
    RETURNING id INTO v_op_id;
    v_op_ids := array_append(v_op_ids, v_op_id);
  END LOOP;

  -- 6. Create 45 assets
  FOR i IN 0..jsonb_array_length(v_asset_specs)-1 LOOP
    v_spec := v_asset_specs->i;
    v_meter := (500 + (i * 173) % 7500)::numeric;
    v_op_pick := v_op_ids[1 + (i % array_length(v_op_ids,1))];
    INSERT INTO public.assets (
      company_id, name, type, make, model, year, registration, serial_number, asset_number,
      location, status, engine_hours, odometer, service_interval_hours, last_service_hours,
      assigned_operator_id, created_by, purchase_price, current_value
    ) VALUES (
      v_company_id,
      v_spec->>'name',
      (v_spec->>'type')::asset_type,
      v_spec->>'make',
      v_spec->>'model',
      (v_spec->>'year')::int,
      'SUM' || lpad((100 + i)::text, 3, '0'),
      upper(substr(md5(v_spec->>'name'), 1, 12)),
      'AST-' || lpad((i+1)::text, 4, '0'),
      v_locations[1 + (i % array_length(v_locations,1))],
      CASE WHEN i % 18 = 0 THEN 'workshop'::asset_status
           WHEN i % 31 = 0 THEN 'broken_down'::asset_status
           ELSE 'active'::asset_status END,
      v_meter,
      CASE WHEN (v_spec->>'type') IN ('truck','prime_mover','ute','water_cart') THEN (v_meter * 60)::int ELSE NULL END,
      500,
      GREATEST(0, v_meter - (50 + (i*17) % 400)),
      v_op_pick,
      _admin_user_id,
      (60000 + (i * 7919) % 350000)::numeric,
      (40000 + (i * 6133) % 280000)::numeric
    )
    RETURNING id INTO v_asset_id;
    v_asset_ids := array_append(v_asset_ids, v_asset_id);

    -- Compliance records (registration + insurance + service)
    INSERT INTO public.compliance_records (asset_id, company_id, type, label, expiry_date, reference)
    VALUES
      (v_asset_id, v_company_id, 'registration', 'Registration', current_date + ((30 + (i*23) % 320) || ' days')::interval, 'REG-' || (1000+i)),
      (v_asset_id, v_company_id, 'insurance', 'Insurance', current_date + ((60 + (i*17) % 280) || ' days')::interval, 'INS-' || (5000+i)),
      (v_asset_id, v_company_id, 'service', 'Next major service', current_date + ((14 + (i*11) % 180) || ' days')::interval, NULL);
  END LOOP;

  -- 7. Prestart checks: ~8 per day for 30 days
  FOR v_day IN 0..29 LOOP
    v_count := 6 + (v_day % 5);
    FOR i IN 1..v_count LOOP
      v_asset_id := v_asset_ids[1 + ((v_day * 7 + i * 13) % array_length(v_asset_ids,1))];
      v_op_pick := v_op_ids[1 + ((v_day * 5 + i * 11) % array_length(v_op_ids,1))];
      v_pass := NOT (v_day % 6 = 0 AND i = 1);
      INSERT INTO public.prestart_checks (
        company_id, asset_id, operator_id, status, completed_at,
        checklist, meter_reading, gps_lat, gps_lng
      ) VALUES (
        v_company_id, v_asset_id, v_op_pick,
        CASE WHEN v_pass THEN 'pass' ELSE 'fail' END,
        v_now - (v_day || ' days')::interval - ((i*47) || ' minutes')::interval,
        jsonb_build_array(
          jsonb_build_object('label','Engine oil level','status','ok'),
          jsonb_build_object('label','Coolant level','status','ok'),
          jsonb_build_object('label','Fuel level','status','ok'),
          jsonb_build_object('label','Hydraulic oil level','status','ok'),
          jsonb_build_object('label','Horn working','status','ok'),
          jsonb_build_object('label','Reverse alarm','status', CASE WHEN v_pass THEN 'ok' ELSE 'fail' END),
          jsonb_build_object('label','Lights operational','status','ok'),
          jsonb_build_object('label','Seatbelt functioning','status','ok'),
          jsonb_build_object('label','Tyres or tracks','status','ok'),
          jsonb_build_object('label','No visible defects','status','ok')
        ),
        (500 + (v_day*7 + i*23) % 8000)::numeric,
        -37.8 + ((i % 9) - 4) * 0.01,
        144.9 + ((v_day % 9) - 4) * 0.01
      );
    END LOOP;
  END LOOP;

  -- 8. Defects (25)
  FOR i IN 1..25 LOOP
    v_asset_id := v_asset_ids[1 + ((i * 19) % array_length(v_asset_ids,1))];
    v_op_pick := v_op_ids[1 + ((i * 7) % array_length(v_op_ids,1))];
    INSERT INTO public.defect_reports (
      company_id, asset_id, operator_id, reported_by,
      severity, status, description, reported_at, resolved_at, resolution_notes
    ) VALUES (
      v_company_id, v_asset_id, v_op_pick, _admin_user_id,
      v_severities[1 + (i % array_length(v_severities,1))],
      v_statuses[1 + (i % array_length(v_statuses,1))],
      v_defect_descs[1 + ((i-1) % array_length(v_defect_descs,1))],
      v_now - ((i * 36) || ' hours')::interval,
      CASE WHEN v_statuses[1 + (i % array_length(v_statuses,1))] = 'resolved'
           THEN v_now - ((i * 12) || ' hours')::interval ELSE NULL END,
      CASE WHEN v_statuses[1 + (i % array_length(v_statuses,1))] = 'resolved'
           THEN 'Repaired by workshop. Parts replaced and tested.' ELSE NULL END
    );
  END LOOP;

  -- 9. Subscription (Pro plan, active)
  INSERT INTO public.subscriptions (
    company_id, paddle_subscription_id, paddle_customer_id, product_id, price_id,
    status, current_period_start, current_period_end, environment, created_by
  ) VALUES (
    v_company_id,
    'sub_demo_' || v_company_id,
    'ctm_demo_' || v_company_id,
    'pro_plan',
    'pro_monthly',
    'active',
    v_now - interval '14 days',
    v_now + interval '16 days',
    'live',
    _admin_user_id
  );

  RETURN v_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_demo_company(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.seed_demo_company(uuid) FROM PUBLIC, anon, authenticated;
