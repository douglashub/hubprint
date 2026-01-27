
# PrintControl SaaS - Sistema de Bilhetagem de Impressão

## 1. Visão Geral

PrintControl SaaS é uma solução moderna e completa para bilhetagem, controle e auditoria de impressão, desenhada para pequenas e médias empresas. A plataforma é 100% web, construída com uma stack tecnológica robusta e escalável, focada em fornecer insights acionáveis sobre o ambiente de impressão das empresas.

## 2. Stack Tecnológica

*   **Frontend:** Angular (Standalone Components), TypeScript, Tailwind CSS
*   **Backend:** Supabase
    *   **Autenticação:** Supabase Auth (JWT)
    *   **Banco de Dados:** PostgreSQL
    *   **Segurança:** Row Level Security (RLS)
    *   **APIs & Lógica de Negócio:** Supabase Edge Functions

## 3. Como Rodar o Projeto (Ambiente de Applet)

Este projeto foi gerado para rodar em um ambiente "Applet" especializado.

1.  **Ambiente:** O código é carregado em um sandbox que compila o Angular no navegador (JIT).
2.  **Execução:** Carregue os arquivos gerados no ambiente de Applet. O `index.tsx` serve como ponto de entrada para bootstrap da aplicação Angular.
3.  **Variáveis de Ambiente:** O ambiente deve prover a variável `process.env.API_KEY` para qualquer integração com APIs, como a da Google GenAI, caso seja adicionada futuramente. Para a simulação atual, nenhuma chave é necessária.

## 4. Configuração do Supabase (Backend)

Para um ambiente de produção real, siga os passos abaixo.

### 4.1. Crie um Projeto no Supabase

1.  Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2.  Salve a **URL do Projeto** e a **Chave `anon`**. Elas seriam usadas no `environment.ts` do Angular.

### 4.2. Schema do Banco de Dados

Execute o seguinte script SQL no **SQL Editor** do Supabase para criar as tabelas e configurar a segurança.

```sql
-- 1. Tabela de Empresas (Tenants)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    plan VARCHAR(50) DEFAULT 'starter' -- e.g., starter, pro, enterprise
);

-- 2. Tabela de Setores (Departamentos)
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Impressoras
CREATE TABLE printers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    model VARCHAR(255),
    location VARCHAR(255),
    type VARCHAR(50) CHECK (type IN ('Laser', 'Jato de Tinta', 'Térmica')),
    is_color BOOLEAN DEFAULT FALSE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Perfis de Usuário (extende auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('company_admin', 'user')),
    avatar_url TEXT
);

-- 5. Tabela de Trabalhos de Impressão (Core)
CREATE TABLE print_jobs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printer_id UUID REFERENCES printers(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    pages_bw INT NOT NULL DEFAULT 0,
    pages_color INT NOT NULL DEFAULT 0,
    total_pages INT GENERATED ALWAYS AS (pages_bw + pages_color) STORED,
    document_name TEXT,
    cost_per_page_bw NUMERIC(10, 4) DEFAULT 0.10,
    cost_per_page_color NUMERIC(10, 4) DEFAULT 0.50,
    total_cost NUMERIC(10, 2) GENERATED ALWAYS AS (pages_bw * cost_per_page_bw + pages_color * cost_per_page_color) STORED,
    printed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Cotas
CREATE TABLE quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NULL,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE NULL,
    monthly_limit_pages INT,
    monthly_limit_cost NUMERIC(10, 2),
    start_date DATE DEFAULT NOW(),
    -- Garante que a cota seja para um usuário OU um departamento, não ambos
    CONSTRAINT user_or_department_quota CHECK (
        (user_id IS NOT NULL AND department_id IS NULL) OR
        (user_id IS NULL AND department_id IS NOT NULL)
    )
);

-- 7. Ativar Row Level Security (RLS) para Multi-Tenancy
-- Função auxiliar para obter company_id do usuário logado
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
DECLARE
    company_id_val UUID;
BEGIN
    SELECT company_id INTO company_id_val FROM public.user_profiles WHERE id = auth.uid();
    RETURN company_id_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar RLS em todas as tabelas sensíveis
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotas ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
-- Apenas usuários da mesma empresa podem ver os dados
CREATE POLICY select_own_company_data ON departments FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY insert_own_company_data ON departments FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY select_own_company_data ON printers FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY insert_own_company_data ON printers FOR INSERT WITH CHECK (company_id = get_my_company_id());
-- ... replicar para as outras tabelas (print_jobs, quotas, etc.)

-- Admins podem gerenciar perfis da sua empresa, usuários podem ver o seu
CREATE POLICY manage_own_company_profiles ON user_profiles FOR ALL
    USING (company_id = get_my_company_id())
    WITH CHECK (company_id = get_my_company_id());

CREATE POLICY view_own_profile ON user_profiles FOR SELECT
    USING (id = auth.uid());
```

## 5. Fluxo do Sistema

1.  **Agente de Coleta (Conceito):** Um pequeno software (não incluído no escopo deste projeto) seria instalado nas máquinas dos usuários ou no servidor de impressão da empresa.
2.  **Envio de Dados:** Ao detectar um trabalho de impressão, o agente coleta os metadados (usuário, nome do documento, contagem de páginas P&B/Cor) e envia para uma **Supabase Edge Function**.
3.  **Processamento (Edge Function):**
    *   A função autentica a requisição.
    *   Verifica as regras e cotas para o usuário/departamento.
    *   Se a impressão for permitida, insere um registro na tabela `print_jobs`.
    *   Se for bloqueada, registra o evento e opcionalmente dispara um alerta.
    *   Calcula o custo e atualiza os contadores.
4.  **Visualização (Frontend Angular):**
    *   O usuário `company_admin` faz login no painel web.
    *   O dashboard exibe dados em tempo real (usando Supabase Realtime).
    *   O admin pode gerenciar usuários, impressoras, definir cotas e visualizar relatórios detalhados.
    *   O `user` final pode ver apenas seu próprio consumo.

## 6. Como Vender o Sistema (Modelo de Negócio)

### Proposta de Valor

"Reduza custos e aumente a segurança do seu ambiente de impressão. O PrintControl SaaS oferece visibilidade total e controle granular sobre quem imprime, o quê, quando e onde, transformando um centro de custo em uma operação otimizada."

### Modelo de Preços (Assinatura Mensal)

O preço é baseado no número de usuários monitorados.

*   **Plano Starter:**
    *   **Preço:** R$ 99/mês
    *   **Limite:** Até 20 usuários
    *   **Funcionalidades:** Dashboard básico, Relatórios padrão, Gestão de usuários e impressoras.

*   **Plano Pro (Mais Popular):**
    *   **Preço:** R$ 249/mês
    *   **Limite:** Até 100 usuários
    *   **Funcionalidades:** Tudo do Starter, mais:
        *   Regras e Cotas avançadas
        *   Alertas por e-mail
        *   Exportação de relatórios (PDF, CSV)
        *   Suporte prioritário

*   **Plano Enterprise:**
    *   **Preço:** Sob consulta
    *   **Limite:** Usuários ilimitados
    *   **Funcionalidades:** Tudo do Pro, mais:
        *   Logs de auditoria
        *   Integração com Active Directory (AD/LDAP)
        *   Suporte dedicado e SLA
        *   Relatórios personalizados

### Estratégia de Go-to-Market

1.  **Público-alvo:** Escritórios de advocacia, contabilidade, escolas, clínicas e empresas de médio porte.
2.  **Canais:** Marketing de conteúdo (blog sobre redução de custos de impressão), Google Ads, parcerias com empresas de TI e revendedores de impressoras.
3.  **Diferencial:** Simplicidade de uso, setup rápido (100% cloud), e um preço competitivo comparado a soluções on-premise tradicionais.
4.  **Trial:** Oferecer um free trial de 14 dias do Plano Pro para que o cliente possa ver o valor na prática.

---
Este `README.md` fornece uma base sólida para o desenvolvimento, implantação e comercialização do PrintControl SaaS.
