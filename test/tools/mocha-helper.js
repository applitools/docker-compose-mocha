async function simulateMochaRun(initCode, testCode) {
  let mochaBeforeReceivedMethod;
  let mochaAfterReceivedMethod;

  const mochaBefore = (b) => {
    mochaBeforeReceivedMethod = b;
  };

  const mochaAfter = (a) => {
    mochaAfterReceivedMethod = a;
  };
  try {
    initCode(mochaBefore, mochaAfter);
    await mochaBeforeReceivedMethod();
    await testCode();
  } finally {
    await mochaAfterReceivedMethod();
  }
}

module.exports = {
  simulateMochaRun,
};
