-- ATENÇÃO: Execute este script no SQL Editor do seu projeto Supabase.

-- =============================================
-- 1. TABELAS
-- =============================================

-- Tabela de Empresas (Tenants)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE public.companies IS 'Armazena as empresas (tenants) do sistema SaaS.';

-- Tabela de Perfis de Usuário (estende auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    pin TEXT,
    cpf TEXT,
    phone TEXT,
    role TEXT DEFAULT 'user' NOT NULL, -- 'company_admin', 'user'
    address JSONB,
    company_profile JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.user_profiles IS 'Dados de perfil adicionais para os usuários, vinculados a uma empresa.';


-- Tabela de Clientes (gerenciados por uma empresa)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    contact_phone TEXT,
    status TEXT NOT NULL, -- 'Ativo', 'Inativo'
    franchise_pages_bw INT DEFAULT 0,
    franchise_value_bw NUMERIC(10, 2) DEFAULT 0,
    franchise_pages_color INT DEFAULT 0,
    franchise_value_color NUMERIC(10, 2) DEFAULT 0,
    overage_cost_bw NUMERIC(10, 4) DEFAULT 0,
    overage_cost_color NUMERIC(10, 4) DEFAULT 0,
    address JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE public.clients IS 'Clientes gerenciados por uma empresa (tenant).';


-- Tabela de Impressoras
CREATE TABLE IF NOT EXISTS public.printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL, -- Pode ser de um cliente ou interna
    location TEXT NOT NULL,
    sector TEXT NOT NULL,
    asset_number TEXT NOT NULL,
    model TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    adf_processor BOOLEAN DEFAULT FALSE,
    ak_748 BOOLEAN DEFAULT FALSE,
    finisher BOOLEAN DEFAULT FALSE,
    cabinet BOOLEAN DEFAULT FALSE,
    transformer_number TEXT,
    installation_date DATE,
    nst_nd BOOLEAN DEFAULT FALSE,
    inst_ocr BOOLEAN DEFAULT FALSE,
    queue TEXT,
    mac_address TEXT,
    ip_address TEXT,
    technician TEXT,
    installation_status TEXT, -- 'OK', 'Pendente'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE public.printers IS 'Impressoras pertencentes a uma empresa (tenant), podendo ser alocadas a um cliente.';

-- Tabela de Agendamentos de Manutenção
CREATE TABLE IF NOT EXISTS public.maintenance_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL, -- 'Preventiva', 'Corretiva'
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    technician TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL, -- 'Agendada', 'Em Andamento', 'Concluída', 'Cancelada'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE public.maintenance_schedules IS 'Agendamentos de manutenção para clientes de uma empresa.';

-- Tabela de Associação: Agendamentos e Impressoras (Muitos para Muitos)
CREATE TABLE IF NOT EXISTS public.maintenance_schedule_printers (
    schedule_id UUID REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE,
    printer_id UUID REFERENCES public.printers(id) ON DELETE CASCADE,
    PRIMARY KEY (schedule_id, printer_id)
);
COMMENT ON TABLE public.maintenance_schedule_printers IS 'Tabela de junção para agendamentos e impressoras.';

-- Tabela de Leituras Manuais de Contadores
CREATE TABLE IF NOT EXISTS public.manual_counter_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    printer_id UUID REFERENCES public.printers(id) ON DELETE CASCADE NOT NULL,
    initial_date DATE NOT NULL,
    final_date DATE NOT NULL,
    initial_counter_bw INT NOT NULL DEFAULT 0,
    final_counter_bw INT NOT NULL DEFAULT 0,
    initial_counter_color INT NOT NULL DEFAULT 0,
    final_counter_color INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE public.manual_counter_readings IS 'Armazena as leituras manuais de contadores para faturamento.';

-- Tabela para Armazenar Relatórios de Manutenção Preventiva Finalizados
DROP TABLE IF EXISTS public.preventive_maintenances CASCADE; -- Garante que a tabela seja recriada com o esquema correto.
CREATE TABLE public.preventive_maintenances (
    id TEXT PRIMARY KEY, -- Formato "schedule_id_printer_id"
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE,
    printer_id UUID REFERENCES public.printers(id) ON DELETE CASCADE,
    report_data JSONB NOT NULL, -- Armazena todo o objeto do relatório (checklist, recomendações, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
COMMENT ON TABLE public.preventive_maintenances IS 'Armazena os dados dos relatórios de manutenção finalizados.';


-- =============================================
-- 2. STORAGE
-- =============================================

-- Cria o bucket para assets se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao Storage
-- Permitir que qualquer pessoa veja os arquivos (são públicos)
CREATE POLICY "Public Read Access" ON storage.objects
FOR SELECT USING (bucket_id = 'assets');

-- Permitir que usuários autenticados façam upload
CREATE POLICY "Authenticated Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');

-- Permitir que usuários atualizem seus próprios arquivos
-- A política é definida em duas partes: user_id e path
CREATE POLICY "User Owns File Update" ON storage.objects
FOR UPDATE USING (bucket_id = 'assets' AND auth.uid() = (storage.foldername(name))[1]::uuid)
WITH CHECK (auth.uid() = (storage.foldername(name))[1]::uuid);

-- Permitir que usuários apaguem seus próprios arquivos
CREATE POLICY "User Owns File Delete" ON storage.objects
FOR DELETE USING (bucket_id = 'assets' AND auth.uid() = (storage.foldername(name))[1]::uuid);


-- =============================================
-- 3. FUNÇÕES E TRIGGERS (AUTOMAÇÃO)
-- =============================================

-- Função para criar um perfil de usuário automaticamente após o cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  company_id_val UUID;
  user_full_name TEXT;
BEGIN
  -- Extrai o nome da empresa e o nome completo dos metadados do usuário
  user_full_name := NEW.raw_user_meta_data->>'full_name';

  -- Assume que um novo cadastro cria uma nova empresa
  INSERT INTO public.companies (name)
  VALUES (NEW.raw_user_meta_data->>'company_name')
  RETURNING id INTO company_id_val;

  -- Insere o perfil do usuário
  INSERT INTO public.user_profiles (id, company_id, full_name, role)
  VALUES (NEW.id, company_id_val, user_full_name, 'company_admin');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar a função acima
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_schedule_printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_counter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventive_maintenances ENABLE ROW LEVEL SECURITY;


-- Função auxiliar para obter o company_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT company_id
    FROM public.user_profiles
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas de Acesso
-- As políticas abaixo garantem que um usuário só pode ver/modificar dados da sua própria empresa.

-- Tabela user_profiles
DROP POLICY IF EXISTS "Allow own read access" ON public.user_profiles;
CREATE POLICY "Allow own read access" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Allow own update access" ON public.user_profiles;
CREATE POLICY "Allow own update access" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Allow company admin to manage profiles" ON public.user_profiles;
CREATE POLICY "Allow company admin to manage profiles" ON public.user_profiles FOR ALL
  USING (get_my_company_id() = company_id)
  WITH CHECK (get_my_company_id() = company_id);

-- Tabela companies
DROP POLICY IF EXISTS "Allow company members to read their company" ON public.companies;
CREATE POLICY "Allow company members to read their company" ON public.companies FOR SELECT
  USING (id = get_my_company_id());

-- Tabela clients
DROP POLICY IF EXISTS "Allow all actions for company members" ON public.clients;
CREATE POLICY "Allow all actions for company members" ON public.clients FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- Tabela printers
DROP POLICY IF EXISTS "Allow all actions for company members" ON public.printers;
CREATE POLICY "Allow all actions for company members" ON public.printers FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- Tabela maintenance_schedules
DROP POLICY IF EXISTS "Allow all actions for company members" ON public.maintenance_schedules;
CREATE POLICY "Allow all actions for company members" ON public.maintenance_schedules FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- Tabela maintenance_schedule_printers
DROP POLICY IF EXISTS "Allow all actions for company members" ON public.maintenance_schedule_printers;
CREATE POLICY "Allow all actions for company members" ON public.maintenance_schedule_printers FOR ALL
  USING ((
    SELECT company_id
    FROM public.maintenance_schedules s
    WHERE s.id = schedule_id
  ) = get_my_company_id());
  
-- Tabela manual_counter_readings
DROP POLICY IF EXISTS "Allow all actions for company members" ON public.manual_counter_readings;
CREATE POLICY "Allow all actions for company members" ON public.manual_counter_readings FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- Tabela preventive_maintenances
DROP POLICY IF EXISTS "Allow all actions for company members" ON public.preventive_maintenances;
CREATE POLICY "Allow all actions for company members" ON public.preventive_maintenances FOR ALL
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- =============================================
-- 5. DADOS INICIAIS (SEED)
-- =============================================
-- Este bloco pode ser executado para popular o banco de dados
-- com os dados de mock para o usuário 'admin@company.com'.
-- ATENÇÃO: Execute isso DEPOIS que o usuário 'admin@company.com' for criado na aplicação.

/*
DO $$
DECLARE
    target_company_id UUID;
    client1_id UUID;
    client2_id UUID;
    client3_id UUID;
    client4_id UUID;
    printer1_id UUID;
    printer2_id UUID;
    printer3_id UUID;
    printer4_id UUID;
    printer5_id UUID;
    maint1_id UUID;
    maint2_id UUID;
    maint3_id UUID;
    maint4_id UUID;
BEGIN
    -- Obtenha o ID da empresa do usuário admin
    SELECT p.company_id INTO target_company_id FROM auth.users u JOIN public.user_profiles p ON u.id = p.id WHERE u.email = 'admin@company.com';

    -- Insere Clientes
    INSERT INTO public.clients (company_id, company_name, trade_name, cnpj, contact_person, contact_email, contact_phone, status, franchise_pages_bw, franchise_value_bw, franchise_pages_color, franchise_value_color, overage_cost_bw, overage_cost_color, address) VALUES
    (target_company_id, 'Advocacia Silva & Associados', 'Advocacia Silva', '12.345.678/0001-99', 'Dr. Ricardo Silva', 'ricardo.silva@advsilva.com', '(11) 98765-4321', 'Ativo', 5000, 200.00, 500, 150.00, 0.10, 0.50, '{"street": "Av. Paulista", "number": "1000", "neighborhood": "Bela Vista", "city": "São Paulo", "state": "SP", "zip": "01310-100"}') RETURNING id INTO client1_id;
    
    INSERT INTO public.clients (company_id, company_name, trade_name, cnpj, contact_person, contact_email, contact_phone, status, franchise_pages_bw, franchise_value_bw, franchise_pages_color, franchise_value_color, overage_cost_bw, overage_cost_color, address) VALUES
    (target_company_id, 'Contabilidade Futura Ltda.', 'Contabilidade Futura', '98.765.432/0001-11', 'Sra. Mariana Costa', 'mariana@contabilidadefutura.com', '(21) 91234-5678', 'Ativo', 10000, 350.00, 1000, 200.00, 0.08, 0.45, '{"street": "Rua da Alfândega", "number": "50", "neighborhood": "Centro", "city": "Rio de Janeiro", "state": "RJ", "zip": "20070-004"}') RETURNING id INTO client2_id;
    
    INSERT INTO public.clients (company_id, company_name, trade_name, cnpj, contact_person, contact_email, contact_phone, status, franchise_pages_bw, franchise_value_bw, franchise_pages_color, franchise_value_color, overage_cost_bw, overage_cost_color, address) VALUES
    (target_company_id, 'Escola Aprender Mais S.A.', 'Escola Aprender Mais', '45.678.912/0001-33', 'Prof. Carlos Andrade', 'diretoria@aprendermais.edu.br', '(31) 95555-8888', 'Inativo', 2000, 100.00, 200, 80.00, 0.12, 0.60, '{"street": "Rua dos Inconfidentes", "number": "800", "neighborhood": "Savassi", "city": "Belo Horizonte", "state": "MG", "zip": "30140-120"}') RETURNING id INTO client3_id;
    
    INSERT INTO public.clients (company_id, company_name, trade_name, cnpj, contact_person, contact_email, contact_phone, status, franchise_pages_bw, franchise_value_bw, franchise_pages_color, franchise_value_color, overage_cost_bw, overage_cost_color, address) VALUES
    (target_company_id, 'Receita Federal do Brasil', 'Receita Federal de Blumenau', '00.394.460/0001-41', 'Sr. Rogério Romes de Freitas', 'rogerio.freitas@rfb.gov.br', '(47) 3321-1234', 'Ativo', 50000, 1500.00, 5000, 1000.00, 0.05, 0.25, '{"street": "Rua Sete de Setembro", "number": "1234", "neighborhood": "Centro", "city": "Blumenau", "state": "SC", "zip": "89010-204"}') RETURNING id INTO client4_id;

    -- Insere Impressoras
    INSERT INTO public.printers (company_id, client_id, location, sector, asset_number, model, serial_number, installation_date, ip_address, technician, installation_status) VALUES
    (target_company_id, client1_id, 'toria1 - Gabinete', 'Gabinete reitoria', '71968', 'MA5500', 'WDS3810191', '2023-01-15', '150.162.204.4', 'Admin User', 'OK') RETURNING id INTO printer1_id;
    
    INSERT INTO public.printers (company_id, client_id, location, sector, asset_number, model, serial_number, installation_date, ip_address, technician, installation_status) VALUES
    (target_company_id, client2_id, 'toria2 - Térreo', 'PROEX', '71965', 'MA5500', 'WDS3810117', '2023-02-20', '150.162.204.77', 'Bob Williams', 'OK') RETURNING id INTO printer2_id;
    
    INSERT INTO public.printers (company_id, client_id, location, sector, asset_number, model, serial_number, installation_date, ip_address, technician, installation_status) VALUES
    (target_company_id, client1_id, 'toria2 - 7 andar', 'SEPLAN', '71693', 'MA5500', 'WDS3810113', '2023-03-01', '150.162.204.96', 'Admin User', 'OK') RETURNING id INTO printer3_id;

    INSERT INTO public.printers (company_id, NULL, 'toria2 - 8 andar', 'PROAD/CAA', '71975', 'MA5500', 'WDS3814284', '2023-04-10', '150.162.204.13', 'Bob Williams', 'Pendente') RETURNING id INTO printer4_id;

    INSERT INTO public.printers (company_id, client_id, location, sector, asset_number, model, serial_number, installation_date, ip_address, technician, installation_status) VALUES
    (target_company_id, client4_id, 'Térreo', 'Atendimento', '72333', 'ECOSYS M3500cix', 'XYZ123456', '2023-05-20', '10.0.0.10', 'Douglas Rodrigues Marques', 'OK') RETURNING id INTO printer5_id;

    -- Insere Agendamentos
    INSERT INTO public.maintenance_schedules (company_id, client_id, type, scheduled_date, scheduled_time, technician, description, status) VALUES
    (target_company_id, client1_id, 'Preventiva', '2024-08-15', '10:00', 'Admin User', 'Limpeza e verificação de rotina.', 'Concluída') RETURNING id INTO maint1_id;
    
    INSERT INTO public.maintenance_schedules (company_id, client_id, type, scheduled_date, scheduled_time, technician, description, status) VALUES
    (target_company_id, client2_id, 'Corretiva', '2024-07-28', '14:30', 'Bob Williams', 'Impressora apresentando atolamento de papel constante na bandeja 2.', 'Em Andamento') RETURNING id INTO maint2_id;
    
    INSERT INTO public.maintenance_schedules (company_id, client_id, type, scheduled_date, scheduled_time, technician, description, status) VALUES
    (target_company_id, client1_id, 'Preventiva', '2024-07-10', '09:00', 'Admin User', 'Troca de kit de manutenção.', 'Concluída') RETURNING id INTO maint3_id;
    
    INSERT INTO public.maintenance_schedules (company_id, client_id, type, scheduled_date, scheduled_time, technician, description, status) VALUES
    (target_company_id, client1_id, 'Preventiva', '2026-01-28', '09:00', 'Douglas Rodrigues Marques', 'Manutenção preventiva anual para todas as impressoras do cliente.', 'Agendada') RETURNING id INTO maint4_id;
    
    -- Associa impressoras aos agendamentos
    INSERT INTO public.maintenance_schedule_printers (schedule_id, printer_id) VALUES
    (maint1_id, printer1_id),
    (maint2_id, printer2_id),
    (maint3_id, printer3_id),
    (maint4_id, printer1_id),
    (maint4_id, printer3_id);

END $$;
*/