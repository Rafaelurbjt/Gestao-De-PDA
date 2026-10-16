/**
 * TelaPda.js
 *
 * A tela principal do PDA, a que o colaborador vê no dia a dia.
 * A cada 3 segundos ela pergunta à API qual é a situação deste aparelho e
 * mostra uma de quatro telas:
 *   sem conexão | bloqueado/manutenção | campo de CPF | acesso liberado
 *
 * Props:
 *   config               -> { servidor, token, numeroSerie, pinAdmin } (ver armazenamento.js)
 *   aoPedirConfiguracao  -> abre a tela de configuração (App.js troca de tela)
 *
 * Rotas usadas (ver routes/dispositivo.js):
 *   GET  /dispositivo/status     -> situação do PDA e quem está com ele
 *   POST /dispositivo/confirmar  -> colaborador digita o CPF para liberar
 *   POST /dispositivo/encerrar   -> colaborador devolve o PDA pelo próprio aparelho
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { chamarApi, formatarCpf } from './api';
import { cores, estilo } from './estilo';

// Intervalo da consulta à API (3 segundos)
const CONSULTAR_A_CADA_MS = 3000;

// A tela que o colaborador vê. Ela pergunta à API, a cada 3 s, a situação deste PDA:
//   em_uso                      -> "Acesso liberado"
//   bloqueado / manutencao      -> "Equipamento bloqueado"
//   livre / reservado           -> campo de CPF
export default function TelaPda({ config, aoPedirConfiguracao }) {
  // Estado = a memória da tela; quando um valor muda, a tela é redesenhada.
  // situacao é null até a primeira resposta da API chegar.
  const [situacao, setSituacao] = useState(null); // resposta de /dispositivo/status
  const [semConexao, setSemConexao] = useState(false);
  const [cpf, setCpf] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmarEncerrar, setConfirmarEncerrar] = useState(false);
  // useRef guarda um valor que NÃO redesenha a tela quando muda: aqui, a contagem dos toques escondidos na marca
  const toques = useRef({ quantidade: 0, desde: 0 });
  // Janela do PIN de administrador: aberta ou não, texto digitado e erro
  const [pedindoSenha, setPedindoSenha] = useState(false);
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [erroSenha, setErroSenha] = useState('');

  // Botão "voltar" do Android não fecha o app
  useEffect(() => {
    // Devolver true = "eu já tratei este botão"; assim o Android não fecha o app.
    // A função devolvida remove o ouvinte quando a tela sai.
    const assinatura = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => assinatura.remove();
  }, []);

  // Pergunta à API a situação deste PDA. Se a API recusar o token do aparelho (401),
  // pede a configuração de novo; qualquer outro erro é tratado como falta de conexão.
  // useCallback mantém a mesma função entre redesenhos, para não reiniciar o timer abaixo.
  const consultar = useCallback(async () => {
    try {
      const s = await chamarApi(config.servidor, '/dispositivo/status', { token: config.token });
      setSituacao(s);
      setSemConexao(false);
    } catch (e) {
      if (e.status === 401) return aoPedirConfiguracao(); // aparelho foi reconfigurado em outro lugar
      setSemConexao(true);
    }
  }, [config, aoPedirConfiguracao]);

  useEffect(() => {
    // Consulta ao abrir e depois a cada 3 s (o colaborador vê a liberação feita pelo balcão em poucos segundos).
    // A função devolvida desliga o timer ao sair da tela.
    consultar();
    const timer = setInterval(consultar, CONSULTAR_A_CADA_MS);
    return () => clearInterval(timer);
  }, [consultar]);

  // Botão "Liberar": o colaborador confirma o CPF. A API confere se é o CPF do check-in feito no balcão.
  async function liberar() {
    setErro('');
    if (cpf.replace(/\D/g, '').length !== 11) return setErro('Digite os 11 números do CPF.');
    setEnviando(true);
    try {
      await chamarApi(config.servidor, '/dispositivo/confirmar', {
        metodo: 'POST', corpo: { cpf }, token: config.token,
      });
      Keyboard.dismiss();
      setCpf('');
      await consultar();
    } catch (e) {
      setErro(e.message);
      setCpf('');
    } finally {
      setEnviando(false);
    }
  }

  // Botão "Sim, encerrar": devolve o PDA pelo próprio aparelho
  async function encerrar() {
    setEnviando(true);
    try {
      await chamarApi(config.servidor, '/dispositivo/encerrar', { metodo: 'POST', token: config.token });
      setConfirmarEncerrar(false);
      await consultar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  }

  // Acesso escondido à configuração: 5 toques no nome "CONTROLE DE PDAs" em até 3 s,
  // depois a senha de administrador definida na configuração
  function toqueNaMarca() {
    const agora = Date.now();
    // .current é onde o useRef guarda o valor. Se passaram mais de 3 s desde o primeiro toque, recomeça a contagem.
    const t = toques.current;
    if (agora - t.desde > 3000) { t.quantidade = 0; t.desde = agora; }
    t.quantidade += 1;
    if (t.quantidade >= 5) {
      t.quantidade = 0;
      if (!config.pinAdmin) return aoPedirConfiguracao(); // aparelho configurado antes da senha existir
      setSenhaDigitada('');
      setErroSenha('');
      setPedindoSenha(true);
    }
  }

  // Compara o PIN digitado com o salvo no aparelho (a API não participa disso)
  function conferirSenha() {
    if (senhaDigitada === config.pinAdmin) {
      setPedindoSenha(false);
      aoPedirConfiguracao();
    } else {
      setErroSenha('Senha incorreta.');
      setSenhaDigitada('');
    }
  }

  // ?. evita erro enquanto situacao ainda é null (antes da primeira resposta)
  const status = situacao?.status;

  // As telas abaixo são exclusivas: só uma das condições é verdadeira por vez.
  // "cond && <algo/>" desenha o algo só quando cond é verdadeira.
  return (
    <View style={estilo.tela}>
      {/* A marca é o botão secreto da configuração: 5 toques seguidos abrem o pedido de PIN */}
      <Pressable onPress={toqueNaMarca}>
        <Text style={estilo.marca}>CONTROLE DE PDAs</Text>
        <Text style={estilo.serie}>{config.numeroSerie}</Text>
      </Pressable>

      <View style={estilo.centro}>
        {/* Primeira consulta ainda sem resposta: círculo de carregamento */}
        {!situacao && !semConexao && <ActivityIndicator size="large" color={cores.vermelho} />}

        {/* Sem conexão: mostra o aviso e continua tentando a cada 3 s; volta sozinho quando a rede voltar */}
        {semConexao && (
          <>
            <Text style={estilo.icone}>📶</Text>
            <Text style={estilo.titulo}>Sem conexão</Text>
            <Text style={estilo.sub}>O PDA não está alcançando o servidor. Confira se ele está no Wi-Fi da base.</Text>
          </>
        )}

        {/* PDA bloqueado ou em manutenção (definido pelo balcão, aba PDAs) */}
        {!semConexao && (status === 'bloqueado' || status === 'manutencao') && (
          <>
            <Text style={estilo.icone}>🔒</Text>
            <Text style={estilo.titulo}>Equipamento bloqueado</Text>
            <Text style={estilo.sub}>
              {status === 'manutencao' ? 'Este PDA está em manutenção.' : 'Procure o líder no balcão.'}
            </Text>
          </>
        )}

        {/* PDA livre ou reservado: pede o CPF. formatarCpf formata enquanto digita; limpa o erro a cada tecla */}
        {!semConexao && (status === 'livre' || status === 'reservado') && (
          <>
            <Text style={estilo.titulo}>Digite seu CPF</Text>
            <Text style={estilo.sub}>para liberar o uso deste PDA</Text>
            <TextInput
              style={[estilo.campo, estilo.campoCpf]}
              value={cpf}
              onChangeText={(t) => { setErro(''); setCpf(formatarCpf(t)); }}
              placeholder="000.000.000-00"
              keyboardType="number-pad"
              maxLength={14}
              onSubmitEditing={liberar}
              returnKeyType="done"
            />
            {!!erro && <Text style={estilo.erro}>{erro}</Text>}
            <TouchableOpacity style={estilo.botao} onPress={liberar} disabled={enviando}>
              {enviando ? <ActivityIndicator color="#fff" /> : <Text style={estilo.botaoTexto}>Liberar</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* PDA em uso: mostra o nome de quem está com ele e permite encerrar (com confirmação em dois toques) */}
        {!semConexao && status === 'em_uso' && (
          <>
            <View style={{ alignSelf: 'center', backgroundColor: cores.verdeClaro, borderRadius: 60, width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 48, color: cores.verde }}>✓</Text>
            </View>
            <Text style={estilo.titulo}>Acesso liberado</Text>
            <Text style={[estilo.sub, { fontSize: 20, color: cores.tinta, fontWeight: '600' }]}>
              {situacao.colaborador?.nome}
            </Text>
            {situacao.colaborador?.desde && (
              <Text style={estilo.sub}>
                desde {new Date(situacao.colaborador.desde).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
            {!!erro && <Text style={estilo.erro}>{erro}</Text>}
            {/* Dois toques para encerrar: o primeiro só abre a pergunta, o segundo confirma */}
            {confirmarEncerrar ? (
              <>
                <Text style={[estilo.sub, { marginTop: 28 }]}>Encerrar o uso e devolver o PDA?</Text>
                <TouchableOpacity style={estilo.botao} onPress={encerrar} disabled={enviando}>
                  {enviando ? <ActivityIndicator color="#fff" /> : <Text style={estilo.botaoTexto}>Sim, encerrar</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={estilo.botaoSecundario} onPress={() => setConfirmarEncerrar(false)}>
                  <Text style={estilo.botaoSecundarioTexto}>Continuar usando</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[estilo.botaoSecundario, { marginTop: 32 }]} onPress={() => setConfirmarEncerrar(true)}>
                <Text style={estilo.botaoSecundarioTexto}>Encerrar uso</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
      {/* Janela do PIN por cima de tudo (estilos sobreposicao/caixa do estilo.js) */}
      {pedindoSenha && (
        <View style={estilo.sobreposicao}>
          <View style={estilo.caixa}>
            <Text style={[estilo.titulo, { fontSize: 20 }]}>Acesso do administrador</Text>
            <TextInput
              style={[estilo.campo, { marginTop: 16, textAlign: 'center' }]}
              value={senhaDigitada}
              onChangeText={(t) => { setErroSenha(''); setSenhaDigitada(t.replace(/\D/g, '')); }}
              keyboardType="number-pad"
              secureTextEntry
              autoFocus
              maxLength={12}
              onSubmitEditing={conferirSenha}
              placeholder="Senha"
            />
            {!!erroSenha && <Text style={estilo.erro}>{erroSenha}</Text>}
            <TouchableOpacity style={estilo.botao} onPress={conferirSenha}>
              <Text style={estilo.botaoTexto}>Entrar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={estilo.botaoSecundario} onPress={() => setPedindoSenha(false)}>
              <Text style={estilo.botaoSecundarioTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}