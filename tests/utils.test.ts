import * as utils from '../src/utils';
import { getValidTags } from '../src/utils';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '../src/github';
import { defaultChangelogRules } from '../src/defaults';

jest.spyOn(core, 'debug').mockImplementation(() => {});
jest.spyOn(core, 'warning').mockImplementation(() => {});

const regex = /^v/;

describe('utils', () => {
  it('extracts branch from ref', () => {
    /*
     * Given
     */
    const remoteRef = 'refs/heads/master';

    /*
     * When
     */
    const branch = utils.getBranchFromRef(remoteRef);

    /*
     * Then
     */
    expect(branch).toEqual('master');
  });

  it('test if ref is PR', () => {
    /*
     * Given
     */
    const remoteRef = 'refs/pull/123/merge';

    /*
     * When
     */
    const isPullRequest = utils.isPr(remoteRef);

    /*
     * Then
     */
    expect(isPullRequest).toEqual(true);
  });

  it('returns valid tags', async () => {
    /*
     * Given
     */
    const testTags = [
      {
        name: 'release-1.2.3',
        commit: { sha: 'string', url: 'string' },
        zipball_url: 'string',
        tarball_url: 'string',
        node_id: 'string',
      },
      {
        name: 'v1.2.3',
        commit: { sha: 'string', url: 'string' },
        zipball_url: 'string',
        tarball_url: 'string',
        node_id: 'string',
      },
    ];
    const mockListTags = jest
      .spyOn(github, 'listTags')
      .mockImplementation(async () => testTags);

    /*
     * When
     */
    const validTags = await getValidTags(regex, false);

    /*
     * Then
     */
    expect(mockListTags).toHaveBeenCalled();
    expect(validTags).toHaveLength(1);
  });

  it('returns sorted tags', async () => {
    /*
     * Given
     */
    const testTags = [
      {
        name: 'v1.2.4-prerelease.1',
        commit: { sha: 'string', url: 'string' },
        zipball_url: 'string',
        tarball_url: 'string',
        node_id: 'string',
      },
      {
        name: 'v1.2.4-prerelease.2',
        commit: { sha: 'string', url: 'string' },
        zipball_url: 'string',
        tarball_url: 'string',
        node_id: 'string',
      },
      {
        name: 'v1.2.4-prerelease.0',
        commit: { sha: 'string', url: 'string' },
        zipball_url: 'string',
        tarball_url: 'string',
        node_id: 'string',
      },
      {
        name: 'v1.2.3',
        commit: { sha: 'string', url: 'string' },
        zipball_url: 'string',
        tarball_url: 'string',
        node_id: 'string',
      },
    ];
    const mockListTags = jest
      .spyOn(github, 'listTags')
      .mockImplementation(async () => testTags);

    /*
     * When
     */
    const validTags = await getValidTags(regex, false);

    /*
     * Then
     */
    expect(mockListTags).toHaveBeenCalled();
    expect(validTags[0]).toEqual({
      name: 'v1.2.4-prerelease.2',
      commit: { sha: 'string', url: 'string' },
      zipball_url: 'string',
      tarball_url: 'string',
      node_id: 'string',
    });
  });

  it('returns only prefixed tags', async () => {
    /*
     * Given
     */
    const testTags = [
      {
        name: 'app2/5.0.0',
        commit: { sha: 'string', url: 'string' },
        zipball_url: 'string',
        tarball_url: 'string',
        node_id: 'string',
      },
      {
        name: '7.0.0',
        commit: { sha: 'string', url: 'string' },
        zipball_url: 'string',
        tarball_url: 'string',
        node_id: 'string',
      },
      {
        name: 'app1/3.0.0',
        commit: { sha: 'string', url: 'string' },
        zipball_url: 'string',
        tarball_url: 'string',
        node_id: 'string',
      },
    ];
    const mockListTags = jest
      .spyOn(github, 'listTags')
      .mockImplementation(async () => testTags);
    /*
     * When
     */
    const validTags = await getValidTags(/^app1\//, false);
    /*
     * Then
     */
    expect(mockListTags).toHaveBeenCalled();
    expect(validTags).toHaveLength(1);
    expect(validTags[0]).toEqual({
      name: 'app1/3.0.0',
      commit: { sha: 'string', url: 'string' },
      zipball_url: 'string',
      tarball_url: 'string',
      node_id: 'string',
    });
  });

  describe('getCommits with path filtering', () => {
    it('returns all commits when no paths specified', async () => {
      /*
       * Given
       */
      const mockCompareCommits = jest
        .spyOn(github, 'compareCommits')
        .mockImplementation(async () => [
          { sha: 'abc123', commit: { message: 'feat: add feature' } },
          { sha: 'def456', commit: { message: 'fix: bug fix' } },
        ] as any);

      /*
       * When
       */
      const commits = await utils.getCommits('base', 'head');

      /*
       * Then
       */
      expect(mockCompareCommits).toHaveBeenCalledWith('base', 'head');
      expect(commits).toHaveLength(2);
      expect(commits).toEqual([
        { message: 'feat: add feature', hash: 'abc123' },
        { message: 'fix: bug fix', hash: 'def456' },
      ]);
    });

    it('filters commits by path when paths are specified', async () => {
      /*
       * Given
       */
      jest
        .spyOn(github, 'compareCommits')
        .mockImplementation(async () => [
          { sha: 'abc123', commit: { message: 'feat: add auth' } },
          { sha: 'def456', commit: { message: 'fix: update readme' } },
          { sha: 'ghi789', commit: { message: 'feat: add login' } },
        ] as any);

      jest.spyOn(exec, 'getExecOutput').mockImplementation(async () => ({
        stdout: 'abc123\nghi789\n',
        stderr: '',
        exitCode: 0,
      }));

      /*
       * When
       */
      const commits = await utils.getCommits('base', 'head', ['src/auth/**']);

      /*
       * Then
       */
      expect(exec.getExecOutput).toHaveBeenCalledWith('git', [
        'log',
        '--format=%H',
        'base..head',
        '--',
        'src/auth/**',
      ]);
      expect(commits).toHaveLength(2);
      expect(commits).toEqual([
        { message: 'feat: add auth', hash: 'abc123' },
        { message: 'feat: add login', hash: 'ghi789' },
      ]);
    });

    it('returns no commits when path filter matches nothing', async () => {
      /*
       * Given
       */
      jest
        .spyOn(github, 'compareCommits')
        .mockImplementation(async () => [
          { sha: 'abc123', commit: { message: 'feat: unrelated' } },
        ] as any);

      jest.spyOn(exec, 'getExecOutput').mockImplementation(async () => ({
        stdout: '\n',
        stderr: '',
        exitCode: 0,
      }));

      /*
       * When
       */
      const commits = await utils.getCommits('base', 'head', ['packages/auth/**']);

      /*
       * Then
       */
      expect(commits).toHaveLength(0);
    });

    it('supports multiple path patterns', async () => {
      /*
       * Given
       */
      jest
        .spyOn(github, 'compareCommits')
        .mockImplementation(async () => [
          { sha: 'abc123', commit: { message: 'feat: auth change' } },
          { sha: 'def456', commit: { message: 'fix: config change' } },
        ] as any);

      jest.spyOn(exec, 'getExecOutput').mockImplementation(async () => ({
        stdout: 'abc123\ndef456\n',
        stderr: '',
        exitCode: 0,
      }));

      /*
       * When
       */
      const commits = await utils.getCommits('base', 'head', [
        'packages/auth/**',
        'packages/config/**',
      ]);

      /*
       * Then
       */
      expect(exec.getExecOutput).toHaveBeenCalledWith('git', [
        'log',
        '--format=%H',
        'base..head',
        '--',
        'packages/auth/**',
        'packages/config/**',
      ]);
      expect(commits).toHaveLength(2);
    });
  });

  describe('getLatestTag', () => {
    it('returns matching non-prerelease tag when one exists', async () => {
      /*
       * Given
       */
      const tags = [
        {
          name: 'v2.0.0',
          commit: { sha: 'abc123', url: 'string' },
          zipball_url: 'string',
          tarball_url: 'string',
          node_id: 'string',
        },
        {
          name: 'v1.0.0',
          commit: { sha: 'def456', url: 'string' },
          zipball_url: 'string',
          tarball_url: 'string',
          node_id: 'string',
        },
      ];

      /*
       * When
       */
      const result = await utils.getLatestTag(tags, regex, 'v');

      /*
       * Then
       */
      expect(result).toEqual(tags[0]);
    });

    it('skips prerelease tags and returns first stable tag', async () => {
      /*
       * Given
       */
      const tags = [
        {
          name: 'v2.0.0-beta.1',
          commit: { sha: 'abc123', url: 'string' },
          zipball_url: 'string',
          tarball_url: 'string',
          node_id: 'string',
        },
        {
          name: 'v1.0.0',
          commit: { sha: 'def456', url: 'string' },
          zipball_url: 'string',
          tarball_url: 'string',
          node_id: 'string',
        },
      ];

      /*
       * When
       */
      const result = await utils.getLatestTag(tags, regex, 'v');

      /*
       * Then
       */
      expect(result.name).toBe('v1.0.0');
    });

    it('returns root commit fallback when no tags match', async () => {
      /*
       * Given
       */
      const tags: any[] = [];

      jest.spyOn(exec, 'getExecOutput').mockImplementation(async () => ({
        stdout: 'a1b2c3d4e5f6\n',
        stderr: '',
        exitCode: 0,
      }));

      /*
       * When
       */
      const result = await utils.getLatestTag(tags, regex, 'v');

      /*
       * Then
       */
      expect(exec.getExecOutput).toHaveBeenCalledWith('git', [
        'rev-list',
        '--max-parents=0',
        'HEAD',
      ]);
      expect(result).toEqual({
        name: 'v0.0.0',
        commit: { sha: 'a1b2c3d4e5f6' },
      });
    });

    it('uses correct tag prefix in fallback name', async () => {
      /*
       * Given
       */
      const tags: any[] = [];
      const prefixRegex = /^sdk\/ts\/auth-v/;

      jest.spyOn(exec, 'getExecOutput').mockImplementation(async () => ({
        stdout: 'rootsha123\n',
        stderr: '',
        exitCode: 0,
      }));

      /*
       * When
       */
      const result = await utils.getLatestTag(
        tags,
        prefixRegex,
        'sdk/ts/auth-v'
      );

      /*
       * Then
       */
      expect(result).toEqual({
        name: 'sdk/ts/auth-v0.0.0',
        commit: { sha: 'rootsha123' },
      });
    });
  });

  describe('custom release types', () => {
    it('maps custom release types', () => {
      /*
       * Given
       */
      const customReleasesString =
        'james:preminor,bond:premajor,007:major:Breaking Changes,feat:minor';

      /*
       * When
       */
      const mappedReleases = utils.mapCustomReleaseRules(customReleasesString);

      /*
       * Then
       */
      expect(mappedReleases).toEqual([
        { type: 'james', release: 'preminor' },
        { type: 'bond', release: 'premajor' },
        { type: '007', release: 'major', section: 'Breaking Changes' },
        {
          type: 'feat',
          release: 'minor',
          section: defaultChangelogRules['feat'].section,
        },
      ]);
    });

    it('filters out invalid custom release types', () => {
      /*
       * Given
       */
      const customReleasesString = 'james:pre-release,bond:premajor';

      /*
       * When
       */
      const mappedReleases = utils.mapCustomReleaseRules(customReleasesString);

      /*
       * Then
       */
      expect(mappedReleases).toEqual([{ type: 'bond', release: 'premajor' }]);
    });
  });

  describe('method: mergeWithDefaultChangelogRules', () => {
    it('combines non-existing type rules with default rules', () => {
      /**
       * Given
       */
      const newRule = {
        type: 'james',
        release: 'major',
        section: '007 Changes',
      };

      /**
       * When
       */
      const result = utils.mergeWithDefaultChangelogRules([newRule]);

      /**
       * Then
       */
      expect(result).toEqual([
        ...Object.values(defaultChangelogRules),
        newRule,
      ]);
    });

    it('overwrites existing default type rules with provided rules', () => {
      /**
       * Given
       */
      const newRule = {
        type: 'feat',
        release: 'minor',
        section: '007 Changes',
      };

      /**
       * When
       */
      const result = utils.mergeWithDefaultChangelogRules([newRule]);
      const overWrittenRule = result.find((rule) => rule.type === 'feat');

      /**
       * Then
       */
      expect(overWrittenRule?.section).toBe(newRule.section);
    });

    it('returns only the rules having changelog section', () => {
      /**
       * Given
       */
      const mappedReleaseRules = [
        { type: 'james', release: 'major', section: '007 Changes' },
        { type: 'bond', release: 'minor', section: undefined },
      ];

      /**
       * When
       */
      const result = utils.mergeWithDefaultChangelogRules(mappedReleaseRules);

      /**
       * Then
       */
      expect(result).toContainEqual(mappedReleaseRules[0]);
      expect(result).not.toContainEqual(mappedReleaseRules[1]);
    });
  });
});
