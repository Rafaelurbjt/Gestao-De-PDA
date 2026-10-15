import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, ScrollView, Text, TextInput, TouchableOpacity } from 'react-native';
import { chamarApi, formatarCpf } from './api';
import { salvarConfig } from './armazenamento';
import { estilo } from './estilo';

// Feita UMA vez por aparelho, pelo líder:
// endereço da API + login do líder + número de série deste PDA.
export default function TelaConfiguracao({ aoConfigurar, aoCancelar, configAtual }) {
  const [servidor, setServidor] = useState(configAtual?.servidor || 'http://192.168.0.10:3000');
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [numeroSerie, setNumeroSerie] = useState(configAtual?.numeroSerie || '');
  const [pinAdmin, setPinAdmin] = useState('');
  const [pinAdmin2, setPinAdmin2] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function configurar() {
    setErro('');
    const url = servidor.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/.+/.test(url)) return setErro('Endereço inválido. Exemplo: http://192.168.0.10:3000');
    if (cpf.replace(/\D/g, '').length !== 11) return setErro('Digite o CPF do líder.');
    if (!senha) return setErro('Digite a senha do líder.');
    if (!numeroSerie.trim()) return setErro('Digite o número de série deste PDA.');
    if (!/^\d{6,}$/.test(pinAdmin)) return setErro('A senha de administrador precisa ter pelo menos 6 números.');
    if (pinAdmin !== pinAdmin2) return setErro('As duas senhas de administrador não conferem.');

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
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="height">
      <ScrollView style={estilo.tela} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={estilo.marca}>CONTROLE DE PDAs</Text>
        <Text style={[estilo.titulo, { textAlign: 'left', marginTop: 16 }]}>Configurar aparelho</Text>
        <Text style={[estilo.sub, { textAlign: 'left' }]}>Feito uma vez, pelo líder. O PDA precisa estar no Wi-Fi da base.</Text>

        <Text style={estilo.rotulo}>Endereço do servidor</Text>
        <TextInput style={estilo.campo} value={servidor} onChangeText={setServidor}
          autoCapitalize="none" autoCorrect={false} keyboardType="url" />

        <Text style={estilo.rotulo}>Número de série deste PDA</Text>
        <TextInput style={estilo.campo} value={numeroSerie} placeholder="CT48-0001"
          onChangeText={(t) => setNumeroSerie(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} />

        <Text style={estilo.rotulo}>CPF do líder</Text>
        <TextInput style={estilo.campo} value={cpf} placeholder="000.000.000-00"
          onChangeText={(t) => setCpf(formatarCpf(t))} keyboardType="number-pad" />

        <Text style={estilo.rotulo}>Senha do líder</Text>
        <TextInput style={estilo.campo} value={senha} onChangeText={setSenha} secureTextEntry />

        <Text style={estilo.rotulo}>Senha de administrador deste PDA</Text>
        <Text style={estilo.dica}>Só números, mínimo 6. Pedida para abrir esta tela de novo.</Text>
        <TextInput style={estilo.campo} value={pinAdmin} onChangeText={(t) => setPinAdmin(t.replace(/\D/g, ''))}
          keyboardType="number-pad" secureTextEntry maxLength={12} />
        <Text style={estilo.rotulo}>Repita a senha de administrador</Text>
        <TextInput style={estilo.campo} value={pinAdmin2} onChangeText={(t) => setPinAdmin2(t.replace(/\D/g, ''))}
          keyboardType="number-pad" secureTextEntry maxLength={12} />

        {!!erro && <Text style={estilo.erro}>{erro}</Text>}

        <TouchableOpacity style={estilo.botao} onPress={configurar} disabled={salvando}>
          {salvando ? <ActivityIndicator color="#fff" /> : <Text style={estilo.botaoTexto}>Salvar configuração</Text>}
        </TouchableOpacity>
        {configAtual && (
          <TouchableOpacity style={estilo.botaoSecundario} onPress={aoCancelar} disabled={salvando}>
            <Text style={estilo.botaoSecundarioTexto}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}