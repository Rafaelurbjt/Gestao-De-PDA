/**
 * TelaConfiguracao.js
 *
 * Tela de configuração do PDA. Aparece quando o aparelho ainda não foi
 * configurado, ou quando o admin a abre de novo (pedindo o PIN).
 * É feita UMA vez por aparelho, por um líder.
 *
 * Props:
 *   aoConfigurar(config) -> chamada ao salvar com sucesso; o App.js segue para a tela do CPF
 *   aoCancelar()         -> volta sem salvar (só existe se o aparelho já estava configurado)
 *   configAtual          -> configuração já salva (ou null na primeira vez)
 *
 * Rotas usadas (ver routes/auth.js e routes/dispositivo.js):
 *   POST /auth/login             -> confirma que quem configura é um líder
 *   POST /dispositivo/registrar  -> cadastra este PDA e devolve o token do aparelho
 */

import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, Text, TextInput, TouchableOpacity } from 'react-native';
// chamarApi fala com a API (api.js); armazenamento guarda a configuração no aparelho
import { chamarApi, formatarCpf } from './api';
import { salvarConfig } from './armazenamento';
import { estilo } from './estilo';

// Feita UMA vez por aparelho, pelo líder:
// endereço da API + login do líder + número de série deste PDA.
export default function TelaConfiguracao({ aoConfigurar, aoCancelar, configAtual }) {
  // O que a pessoa digita em cada campo. O endereço e o número de série já vêm
  // preenchidos se o aparelho estava configurado (configAtual?. evita erro quando é null).
  const [servidor, setServidor] = useState(configAtual?.servidor || 'http://192.168.0.10:3000');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [numeroSerie, setNumeroSerie] = useState(configAtual?.numeroSerie || '');
  const [pinAdmin, setPinAdmin] = useState('');
  const [pinAdmin2, setPinAdmin2] = useState('');
  // erro = mensagem vermelha; salvando = mostra o círculo de carregamento e trava os botões
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Botão "Salvar configuração": valida, faz login do líder, registra o PDA e guarda tudo
  async function configurar() {
    setErro('');
    // Tira espaços e barras do fim ("http://x:3000/" vira "http://x:3000") para as rotas não ficarem com //
    const url = servidor.trim().replace(/\/+$/, '');
    // Validações locais, uma por campo. Cada uma para na primeira que falhar (return).
    if (!/^https?:\/\/.+/.test(url)) return setErro('Endereço inválido. Exemplo: http://192.168.0.10:3000');
    if (cpf.replace(/\D/g, '').length !== 11) return setErro('Digite o CPF do líder.');
    if (!senha) return setErro('Digite a senha do líder.');
    if (!numeroSerie.trim()) return setErro('Digite o número de série deste PDA.');
    if (!/^\d{6,}$/.test(pinAdmin)) return setErro('A senha de administrador precisa ter pelo menos 6 números.');
    if (pinAdmin !== pinAdmin2) return setErro('As duas senhas de administrador não conferem.');

    // Passo 1: login do líder (prova que ele pode configurar).
    // Passo 2: registra o PDA usando o token do líder; a API devolve o token do aparelho.
    // Passo 3: guarda tudo no cofre do PDA. O pinAdmin só existe no aparelho; a API nunca o recebe.
    setSalvando(true);
    try {
      const login = await chamarApi(url, '/auth/login', { metodo: 'POST', corpo: { cpf, senha } });
      const registro = await chamarApi(url, '/dispositivo/registrar', {
        metodo: 'POST',
        corpo: { numero_serie: numeroSerie },
        tokenLider: login.token,
      });
      const config = { servidor: url, token: registro.token, numeroSerie: registro.numero_serie, pinAdmin };
      await salvarConfig(config);
      aoConfigurar(config);
    } catch (e) {
      setErro(e.message);
    // Roda sempre: destrava os botões, com sucesso ou erro
    } finally {
      setSalvando(false);
    }
  }

  // KeyboardAvoidingView empurra o conteúdo para cima quando o teclado abre;
  // ScrollView deixa rolar; keyboardShouldPersistTaps="handled" faz o toque no botão
  // funcionar com o teclado aberto (sem isso, o primeiro toque só fecharia o teclado).
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ScrollView style={estilo.tela} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={estilo.marca}>CONTROLE DE PDAs</Text>
        <Text style={[estilo.titulo, { textAlign: 'left', marginTop: 16 }]}>Configurar aparelho</Text>
        <Text style={[estilo.sub, { textAlign: 'left' }]}>Feito uma vez, pelo líder. O PDA precisa estar no Wi-Fi da base.</Text>

        {/* autoCapitalize/autoCorrect desligados: endereços não devem ser "corrigidos" pelo teclado */}
        <Text style={estilo.rotulo}>Endereço do servidor</Text>
        <TextInput style={estilo.campo} value={servidor} onChangeText={setServidor}
          autoCapitalize="none" autoCorrect={false} keyboardType="url" />

        {/* Número de série sempre em maiúsculas, como no cadastro do balcão */}
        <Text style={estilo.rotulo}>Número de série deste PDA</Text>
        <TextInput style={estilo.campo} value={numeroSerie} placeholder="CT48-0001"
          onChangeText={(t) => setNumeroSerie(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} />

        {/* formatarCpf coloca pontos e traço enquanto digita; number-pad mostra teclado numérico */}
        <Text style={estilo.rotulo}>CPF do líder</Text>
        <TextInput style={estilo.campo} value={cpf} placeholder="000.000.000-00"
          onChangeText={(t) => setCpf(formatarCpf(t))} keyboardType="number-pad" />

        {/* secureTextEntry esconde a senha (equivale ao type="password" da web) */}
        <Text style={estilo.rotulo}>Senha do líder</Text>
        <TextInput style={estilo.campo} value={senha} onChangeText={setSenha} secureTextEntry />

        {/* PIN de administrador: só dígitos (replace remove o resto), pedido para reabrir esta tela */}
        <Text style={estilo.rotulo}>Senha de administrador deste PDA</Text>
        <Text style={estilo.dica}>Só números, mínimo 6. Pedida para abrir esta tela de novo.</Text>
        <TextInput style={estilo.campo} value={pinAdmin} onChangeText={(t) => setPinAdmin(t.replace(/\D/g, ''))}
          keyboardType="number-pad" secureTextEntry maxLength={12} />
        <Text style={estilo.rotulo}>Repita a senha de administrador</Text>
        <TextInput style={estilo.campo} value={pinAdmin2} onChangeText={(t) => setPinAdmin2(t.replace(/\D/g, ''))}
          keyboardType="number-pad" secureTextEntry maxLength={12} />

        {/* !!erro vira true/false. Sem isso, o texto vazio "" seria desenhado fora de um <Text>, o que quebra o React Native. */}
        {!!erro && <Text style={estilo.erro}>{erro}</Text>}

        {/* TouchableOpacity é o botão do React Native (escurece ao toque). Enquanto salva, mostra o círculo no lugar do texto. */}
        <TouchableOpacity style={estilo.botao} onPress={configurar} disabled={salvando}>
          {salvando ? <ActivityIndicator color="#fff" /> : <Text style={estilo.botaoTexto}>Salvar configuração</Text>}
        </TouchableOpacity>
        {/* Cancelar só aparece se o PDA já estava configurado (senão não há para onde voltar) */}
        {configAtual && (
          <TouchableOpacity style={estilo.botaoSecundario} onPress={aoCancelar} disabled={salvando}>
            <Text style={estilo.botaoSecundarioTexto}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}