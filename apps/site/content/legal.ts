export type LegalSection = Readonly<{
  heading: string;
  paragraphs: readonly string[];
  list?: readonly string[];
}>;

export type LegalPage = Readonly<{
  title: string;
  metaDescription: string;
  intro: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
}>;

import { contactDetails, siteName } from "@/content/site";

const legalEntity = siteName;
const registeredAddress = contactDetails.address;
const legalEmail = contactDetails.email;
const legalPhone = contactDetails.phone;

export const legalInfoPage: LegalPage = {
  title: "Informação Legal",
  metaDescription:
    "Identificação da empresa responsável pela Lumenva, condições de utilização do site e propriedade intelectual.",
  intro:
    "Esta página identifica a entidade responsável pelo website da Lumenva e as condições gerais de utilização.",
  lastUpdated: "2026-08-11",
  sections: [
    {
      heading: "Identificação da empresa",
      paragraphs: [],
      list: [
        `Denominação social: ${legalEntity}`,
        `Sede: ${registeredAddress}`,
        `Contacto: ${legalEmail}`,
      ],
    },
    {
      heading: "Objeto do site",
      paragraphs: [
        "Este website tem como objetivo apresentar a plataforma Lumenva de atendimento e vendas com IA e permitir o pedido de demonstração do produto.",
      ],
    },
    {
      heading: "Propriedade intelectual",
      paragraphs: [
        "O conteúdo deste site, incluindo textos, imagens, marca e logótipo Lumenva, é propriedade da empresa identificada acima ou das entidades que licenciaram o seu uso, e está protegido pelas leis de propriedade intelectual aplicáveis.",
        "É proibida a reprodução, distribuição ou utilização deste conteúdo sem autorização prévia, salvo nos casos previstos por lei.",
      ],
    },
    {
      heading: "Condições de utilização",
      paragraphs: [
        "A utilização deste website pressupõe a aceitação das presentes condições. A empresa reserva-se o direito de alterar o conteúdo do site sem aviso prévio.",
      ],
    },
    {
      heading: "Limitação de responsabilidade",
      paragraphs: [
        "A empresa procura manter a informação disponível neste site atualizada e correta, mas não garante a ausência de erros ou omissões. A utilização da informação disponibilizada é da responsabilidade do utilizador.",
      ],
    },
    {
      heading: "Lei aplicável e foro",
      paragraphs: [
        "As presentes condições regem-se pela lei portuguesa. Para a resolução de qualquer litígio emergente da utilização deste site, é competente o foro legalmente aplicável, sem prejuízo do recurso a mecanismos de resolução alternativa de litígios de consumo.",
      ],
    },
  ],
};

export const privacyPolicyPage: LegalPage = {
  title: "Política de Privacidade",
  metaDescription:
    "Como a Lumenva trata dados pessoais no seu website institucional, em conformidade com o RGPD.",
  intro:
    "O website da Lumenva é uma montra institucional: não existe compra online, criação de conta nem contratação diretamente pelo site. Esta política explica que dados podem ser tratados durante a utilização normal do site, para que finalidade e quais os direitos do titular, nos termos do Regulamento Geral sobre a Proteção de Dados (RGPD).",
  lastUpdated: "2026-08-11",
  sections: [
    {
      heading: "Responsável pelo tratamento",
      paragraphs: [
        `A Lumenva é a responsável pelo tratamento dos dados pessoais recolhidos através deste website, contactável através de ${legalEmail} ou ${legalPhone}.`,
      ],
    },
    {
      heading: "Dados técnicos automáticos",
      paragraphs: [
        "Durante a navegação normal no site podem ser tratados dados técnicos necessários ao seu funcionamento, segurança e alojamento:",
      ],
      list: ["Endereço IP", "Data e hora de acesso", "Browser e user-agent"],
    },
    {
      heading: "Dados do formulário de contacto",
      paragraphs: [
        "Quando preenche voluntariamente o formulário de pedido de demonstração/contacto, são tratados os dados que aí introduz:",
      ],
      list: [
        "Nome",
        "Empresa",
        "E-mail",
        "Número de WhatsApp",
        "Mensagem (quando preenchida)",
      ],
    },
    {
      heading: "Finalidades",
      paragraphs: [],
      list: [
        "Funcionamento técnico do site",
        "Segurança e prevenção de abuso",
        "Diagnóstico de erros",
        "Responder a pedidos de demonstração ou contacto submetidos através do formulário",
        "Cumprimento de obrigações legais, quando aplicável",
      ],
    },
    {
      heading: "Base legal",
      paragraphs: [
        "O tratamento de dados técnicos necessários ao funcionamento e segurança do site tem por base o interesse legítimo da Lumenva e, quando aplicável, o cumprimento de obrigações legais.",
        "O tratamento dos dados submetidos no formulário de contacto tem por base o consentimento dado expressamente pelo titular ao assinalar a casa de consentimento no momento do envio.",
      ],
    },
    {
      heading: "Conservação dos dados",
      paragraphs: [
        "Os dados técnicos são conservados apenas durante o período necessário às respetivas finalidades e de acordo com os prazos definidos pelos fornecedores de infraestrutura utilizados.",
        "Os dados submetidos no formulário são conservados enquanto for necessário para responder ao pedido e gerir a eventual relação comercial subsequente.",
      ],
    },
    {
      heading: "Destinatários e subcontratantes",
      paragraphs: [
        "O website é alojado na Vercel, que atua como subcontratante para efeitos de alojamento e infraestrutura.",
        "O envio do e-mail gerado pelo formulário de contacto é processado através da Resend, que atua como subcontratante para efeitos de envio de e-mail.",
        "Os dados não são vendidos nem partilhados com terceiros para fins de marketing.",
      ],
    },
    {
      heading: "Direitos do titular",
      paragraphs: ["Nos termos do RGPD, tem direito a:"],
      list: [
        "Aceder aos seus dados",
        "Retificar dados incorretos",
        "Solicitar o apagamento dos dados, quando aplicável",
        "Solicitar a limitação do tratamento",
        "Opor-se ao tratamento",
        "Solicitar a portabilidade dos dados, quando aplicável",
        "Retirar o consentimento a qualquer momento, quando o tratamento dependa dele",
        "Apresentar reclamação junto da Comissão Nacional de Proteção de Dados (CNPD)",
      ],
    },
    {
      heading: "Como exercer os direitos",
      paragraphs: [
        `Para exercer qualquer um destes direitos, contacte-nos através de ${legalEmail}. Os pedidos serão tratados nos prazos legalmente aplicáveis previstos no RGPD.`,
      ],
    },
    {
      heading: "Segurança e transferências internacionais",
      paragraphs: [
        "São adotadas medidas técnicas e organizativas adequadas para proteger os dados tratados através deste site.",
        "Caso algum dos fornecedores acima referidos trate dados fora do Espaço Económico Europeu, são utilizadas as salvaguardas legalmente exigidas, nomeadamente cláusulas contratuais-tipo aprovadas pela Comissão Europeia.",
      ],
    },
  ],
};
