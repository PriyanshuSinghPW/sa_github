import copy from 'rollup-plugin-copy';

export default {
  input: 'script.js',
  output: {
    file: 'dist/bundle.js',
    format: 'iife',
    name: 'CrosswordGame',
    sourcemap: false
  },
  plugins: [
    copy({
      targets: [
        { src: 'style.css', dest: 'dist' },
        { src: '*.json', dest: 'dist' },
        { src: 'index.html', dest: 'dist' }
      ]
    })
  ]
};
