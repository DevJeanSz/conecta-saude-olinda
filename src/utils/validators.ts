export const validarCNS = (cns: string): boolean => {
  const cleanCns = cns.replace(/\D/g, '');
  
  if (cleanCns.length !== 15) {
      return false;
  }
  
  let soma = 0;
  for (let i = 0; i < 15; i++) {
      soma += parseInt(cleanCns[i], 10) * (15 - i);
  }
  
  return soma % 11 === 0;
};

export const formatCEP = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue.length > 5) {
    return `${cleanValue.slice(0, 5)}-${cleanValue.slice(5, 8)}`;
  }
  return cleanValue;
};

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export const buscarCEP = async (cep: string): Promise<ViaCepResponse | null> => {
  const cleanCep = cep.replace(/\D/g, '');
  
  if (cleanCep.length !== 8) {
      return null;
  }
  
  try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (data.erro) {
          return null;
      }
      
      return data as ViaCepResponse;
  } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      return null;
  }
};
