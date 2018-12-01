function _hoge() {}
export const hoge = _hoge();
export const moge = function moge() {};
export default {
  hoge: hoge,
  moge: moge
};
