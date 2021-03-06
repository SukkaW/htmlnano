import { init } from '../htmlnano';
import safePreset from '../../lib/presets/safe';
import maxPreset from '../../lib/presets/max';


describe('minifySvg', () => {
    const options = {
        minifySvg: safePreset.minifySvg,
    };
    const svg = `<svg version="1.1" baseProfile="full" width="300" height="200" xmlns="http://www.w3.org/2000/svg">
        <g>
            <rect width="100%" height="100%" fill="red" />

            <circle cx="150" cy="100" r="80" fill="green" />

            <text id="myText" x="150" y="125" font-size="60" text-anchor="middle" fill="white">SVG</text>

            <use href="#myText" x="2" y="2"></use>
        </g>
    </svg>`;

    it('should minify SVG inside <svg>', () => {
        return init(
            svg,

            '<svg baseProfile="full" width="300" height="200" xmlns="http://www.w3.org/2000/svg"><g><rect width="100%" height="100%" fill="red"/><circle cx="150" cy="100" r="80" fill="green"/><text id="a" x="150" y="125" font-size="60" text-anchor="middle" fill="#fff">SVG</text><use href="#a" x="2" y="2"/></g></svg>',

            options
        );
    });

    it('should not minify SVG colors if this option is disabled', () => {
        return init(
            svg,

            '<svg baseProfile="full" width="300" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="red"/><circle cx="150" cy="100" r="80" fill="green"/><text id="a" x="150" y="125" font-size="60" text-anchor="middle" fill="white">SVG</text><use href="#a" x="2" y="2"/></svg>',

            {
                minifySvg: {
                    plugins: [
                        { convertColors: false }
                    ]
                }
            }
        );
    });

    it('should collapse useless <g> groups with max preset', () => {
        return init(
            svg,

            '<svg baseProfile="full" width="300" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="red"/><circle cx="150" cy="100" r="80" fill="green"/><text id="a" x="150" y="125" font-size="60" text-anchor="middle" fill="#fff">SVG</text><use href="#a" x="2" y="2"/></svg>',

            {minifySvg: maxPreset.minifySvg}
        );
    });
});
